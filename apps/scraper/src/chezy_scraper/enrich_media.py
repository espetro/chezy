# pyright: basic
# pyarrow ships partial type information, so strict inference cannot resolve its API.
"""Photo enrichment: label every mirrored photo with a VLM and compute image statistics.

Reads `<root>/data/media.parquet`, sends each photo with a local `path` to the
OpenAI-compatible chat completions API configured in `Settings` (Nebius AI Studio or
the local bifrost), and writes `<root>/enriched/media_features.parquet`: one row per
photo with the model's labels plus Pillow-only luminance, colorfulness, sharpness and a
perceptual hash.

Raw responses are cached per listing at
`<root>/enriched/cache/vlm/<platform>/<platform_id>.json`, so a rerun only calls the model
for photos that are missing from the cache or failed last time.
"""

from __future__ import annotations

import base64
import json
import math
import re
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from http import HTTPStatus
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final

import httpx
import pyarrow as pa
import pyarrow.parquet as pq
from PIL import Image, UnidentifiedImageError

if TYPE_CHECKING:
    from collections.abc import Callable

    from chezy_scraper.config import Settings

VLM_FIELDS: Final = (
    "room_type_pred",
    "brightness",
    "floor_material",
    "wall_condition",
    "condition",
    "kitchen_modern",
    "bath_modern",
    "furnished_level",
    "view",
    "outdoor_space",
    "notes",
)
_BOOL_FIELDS: Final = frozenset({"kitchen_modern", "bath_modern"})
MAX_ATTEMPTS: Final = 3
STATS_LONG_EDGE: Final = 256
_HASH_SIZE: Final = 8
_DCT_SIZE: Final = 32
_LAPLACIAN_MIN_EDGE: Final = 3
_TIMEOUT_S: Final = 60.0
_MAX_TOKENS: Final = 400
_BACKOFF_S: Final = (1.0, 2.0)
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)

PROMPT: Final = "\n".join(
    (
        "You are labelling one photo from a Barcelona property listing.",
        "Return ONLY a JSON object with exactly these keys:",
        (
            "- room_type_pred: one of living_room, bedroom, kitchen, bathroom, dining_room, "
            "hallway, entryway, terrace, balcony, outdoor, exterior, plan, other"
        ),
        '- brightness: "bright" or "dim"',
        (
            "- floor_material: short lowercase label (for example wood, tile, laminate, marble, "
            "terrazzo) or null if no floor is visible"
        ),
        (
            "- wall_condition: short lowercase label (for example good, painted, excellent, "
            "tiled, exposed_brick) or null"
        ),
        "- condition: one of renovated, good, dated, needs_work",
        "- kitchen_modern: true or false if a kitchen is visible, otherwise null",
        "- bath_modern: true or false if a bathroom is visible, otherwise null",
        "- furnished_level: one of furnished, partial, unfurnished",
        "- view: one of none, city, courtyard, street, sea, mountain",
        "- outdoor_space: one of none, balcony, terrace, patio, garden",
        "- notes: one sentence describing what is visible",
        "Use null when a field cannot be judged from the photo. No prose outside the JSON.",
    )
)

FEATURE_SCHEMA: Final = pa.schema(
    [
        pa.field("room_type_pred", pa.string()),
        pa.field("brightness", pa.string()),
        pa.field("floor_material", pa.string()),
        pa.field("wall_condition", pa.string()),
        pa.field("condition", pa.string()),
        pa.field("kitchen_modern", pa.bool_()),
        pa.field("bath_modern", pa.bool_()),
        pa.field("furnished_level", pa.string()),
        pa.field("view", pa.string()),
        pa.field("outdoor_space", pa.string()),
        pa.field("notes", pa.string()),
        pa.field("platform", pa.string()),
        pa.field("platform_id", pa.string()),
        pa.field("position", pa.int64()),
        pa.field("path", pa.string()),
        pa.field("width", pa.int64()),
        pa.field("height", pa.int64()),
        pa.field("aspect", pa.float64()),
        pa.field("luminance", pa.float64()),
        pa.field("colorfulness", pa.float64()),
        pa.field("sharpness", pa.float64()),
        pa.field("phash", pa.string()),
        pa.field("model", pa.string()),
        pa.field("ok", pa.bool_()),
    ]
)

Fields = dict[str, str | bool | None]


@dataclass(frozen=True)
class PhotoResult:
    position: int
    ok: bool
    attempts: int
    error: str | None
    fields: Fields


@dataclass(frozen=True)
class ListingCache:
    platform: str
    platform_id: str
    model: str
    photos: list[PhotoResult]


@dataclass(frozen=True)
class ImageStats:
    width: int
    height: int
    aspect: float
    luminance: float
    colorfulness: float
    sharpness: float
    phash: str


@dataclass(frozen=True)
class EnrichResult:
    listings: int
    photos: int
    ok: int
    failed: int
    out_path: Path


@dataclass(frozen=True)
class _Attempt:
    """Outcome of one chat completion: labels, or an error and whether retrying may help."""

    fields: Fields | None = None
    error: str | None = None
    retryable: bool = True


@dataclass(frozen=True)
class Vlm:
    """Everything one labelling call needs; shared by every worker thread."""

    client: httpx.Client
    base_url: str
    api_key: str
    model: str
    sleep: Callable[[float], object] = time.sleep


# --- image statistics -------------------------------------------------------------------


def _dct_matrix(n: int) -> list[list[float]]:
    return [
        [
            math.cos((2 * x + 1) * u * math.pi / (2 * n))
            * (math.sqrt(1 / n) if u == 0 else math.sqrt(2 / n))
            for x in range(n)
        ]
        for u in range(n)
    ]


_DCT: Final = _dct_matrix(_DCT_SIZE)


def _pixels(band: Image.Image) -> list[float]:
    """Flat float pixels of a single-band image (Pillow types the accessor as a union)."""
    return [float(v) for v in band.get_flattened_data()]  # type: ignore[arg-type]


def _phash(gray: Image.Image) -> str:
    small = gray.resize((_DCT_SIZE, _DCT_SIZE), Image.Resampling.LANCZOS)
    pixels = _pixels(small)
    rows = [pixels[y * _DCT_SIZE : (y + 1) * _DCT_SIZE] for y in range(_DCT_SIZE)]
    # Separable DCT-II: rows first, then columns, keeping only the low 8x8 block.
    row_dct = [
        [sum(_DCT[u][x] * row[x] for x in range(_DCT_SIZE)) for u in range(_HASH_SIZE)]
        for row in rows
    ]
    block = [
        sum(_DCT[v][y] * row_dct[y][u] for y in range(_DCT_SIZE))
        for v in range(_HASH_SIZE)
        for u in range(_HASH_SIZE)
    ]
    median = statistics.median(block)
    bits = 0
    for coefficient in block:
        bits = (bits << 1) | (1 if coefficient > median else 0)
    return f"{bits:016x}"


def _laplacian_variance(gray: Image.Image) -> float:
    w, h = gray.size
    if w < _LAPLACIAN_MIN_EDGE or h < _LAPLACIAN_MIN_EDGE:
        return 0.0
    px = _pixels(gray)
    values = [
        px[y * w + x - 1]
        + px[y * w + x + 1]
        + px[(y - 1) * w + x]
        + px[(y + 1) * w + x]
        - 4 * px[y * w + x]
        for y in range(1, h - 1)
        for x in range(1, w - 1)
    ]
    return statistics.pvariance(values) if len(values) > 1 else 0.0


def _colorfulness(rgb: Image.Image) -> float:
    r, g, b = (_pixels(band) for band in rgb.split())
    rg = [ri - gi for ri, gi in zip(r, g, strict=True)]
    yb = [0.5 * (ri + gi) - bi for ri, gi, bi in zip(r, g, b, strict=True)]
    return math.hypot(statistics.pstdev(rg), statistics.pstdev(yb)) + 0.3 * math.hypot(
        statistics.fmean(rg), statistics.fmean(yb)
    )


def image_stats(path: Path) -> ImageStats:
    with Image.open(path) as source:
        width, height = source.size
        rgb = source.convert("RGB")
    scale = STATS_LONG_EDGE / max(width, height)
    if scale < 1:
        rgb = rgb.resize(
            (max(1, round(width * scale)), max(1, round(height * scale))),
            Image.Resampling.LANCZOS,
        )
    gray = rgb.convert("L")
    return ImageStats(
        width=width,
        height=height,
        aspect=width / height,
        luminance=statistics.fmean(_pixels(gray)) / 255,
        colorfulness=_colorfulness(rgb),
        sharpness=_laplacian_variance(gray),
        phash=_phash(gray),
    )


# --- VLM call ---------------------------------------------------------------------------


def _coerce(raw: dict[str, Any]) -> Fields:
    out: Fields = {}
    for key in VLM_FIELDS:
        value = raw.get(key)
        if value is None:
            out[key] = None
        elif key in _BOOL_FIELDS:
            out[key] = value if isinstance(value, bool) else None
        else:
            out[key] = str(value)
    return out


def _parse_reply(body: object) -> _Attempt:
    content: object = None
    if isinstance(body, dict):
        choices = body.get("choices")
        if isinstance(choices, list) and choices and isinstance(choices[0], dict):
            message = choices[0].get("message")
            if isinstance(message, dict):
                content = message.get("content")
    if not isinstance(content, str):
        return _Attempt(error="reply content is not text")
    try:
        parsed = json.loads(_FENCE.sub("", content.strip()))
    except json.JSONDecodeError as exc:
        return _Attempt(error=f"reply is not JSON: {exc.msg}")
    if not isinstance(parsed, dict):
        return _Attempt(error="reply JSON is not an object")
    return _Attempt(fields=_coerce(parsed))


def label_photo(vlm: Vlm, image_bytes: bytes) -> _Attempt:
    """One chat completion for one photo."""
    data_url = f"data:image/webp;base64,{base64.b64encode(image_bytes).decode('ascii')}"
    payload = {
        "model": vlm.model,
        "temperature": 0,
        "max_tokens": _MAX_TOKENS,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
    }
    try:
        response = vlm.client.post(
            f"{vlm.base_url.rstrip('/')}/chat/completions",
            json=payload,
            headers={"authorization": f"Bearer {vlm.api_key}"},
            timeout=_TIMEOUT_S,
        )
    except httpx.HTTPError as exc:
        return _Attempt(error=f"network: {exc.__class__.__name__}")
    status = response.status_code
    if status == HTTPStatus.TOO_MANY_REQUESTS or status >= HTTPStatus.INTERNAL_SERVER_ERROR:
        return _Attempt(error=f"HTTP {status}")
    if status >= HTTPStatus.BAD_REQUEST:
        return _Attempt(error=f"HTTP {status}", retryable=False)
    try:
        body = response.json()
    except json.JSONDecodeError:
        return _Attempt(error="response body is not JSON")
    return _parse_reply(body)


def label_with_retries(vlm: Vlm, image_bytes: bytes, position: int) -> PhotoResult:
    error = "no attempt made"
    attempts = 0
    for attempt in range(1, MAX_ATTEMPTS + 1):
        attempts = attempt
        outcome = label_photo(vlm, image_bytes)
        if outcome.fields is not None:
            return PhotoResult(
                position=position, ok=True, attempts=attempts, error=None, fields=outcome.fields
            )
        error = outcome.error or "unknown error"
        if not outcome.retryable:
            break
        if attempt < MAX_ATTEMPTS:
            vlm.sleep(_BACKOFF_S[min(attempt - 1, len(_BACKOFF_S) - 1)])
    return PhotoResult(
        position=position, ok=False, attempts=attempts, error=error, fields=_coerce({})
    )


# --- per-listing cache ------------------------------------------------------------------


def cache_path(root: Path, platform: str, platform_id: str) -> Path:
    return root / "enriched" / "cache" / "vlm" / platform / f"{platform_id}.json"


def _read_cache(path: Path) -> ListingCache | None:
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        photos = [
            PhotoResult(
                position=int(p["position"]),
                ok=bool(p["ok"]),
                attempts=int(p["attempts"]),
                error=p.get("error"),
                fields=_coerce(p.get("fields") or {}),
            )
            for p in raw["photos"]
        ]
        return ListingCache(raw["platform"], raw["platform_id"], raw["model"], photos)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return None


def _write_cache(path: Path, cache: ListingCache) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(asdict(cache), ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def enrich_listing(
    vlm: Vlm,
    root: Path,
    platform: str,
    platform_id: str,
    photos: list[tuple[int, str]],
    *,
    refresh: bool = False,
) -> ListingCache:
    """Label every photo of one listing, reusing cached successes unless `refresh`."""
    target = cache_path(root, platform, platform_id)
    cached = None if refresh else _read_cache(target)
    reusable = {p.position: p for p in cached.photos if p.ok} if cached else {}
    results: list[PhotoResult] = []
    for position, rel_path in photos:
        if position in reusable:
            results.append(reusable[position])
            continue
        file = root / rel_path
        if not file.is_file():
            results.append(
                PhotoResult(
                    position=position,
                    ok=False,
                    attempts=0,
                    error="missing file",
                    fields=_coerce({}),
                )
            )
            continue
        results.append(label_with_retries(vlm, file.read_bytes(), position))
    cache = ListingCache(platform, platform_id, vlm.model, results)
    _write_cache(target, cache)
    return cache


# --- table --------------------------------------------------------------------------------

_Key = tuple[str, str, int]


def write_media_features(
    caches: list[ListingCache],
    paths: dict[_Key, str],
    stats: dict[_Key, ImageStats | None],
    out: Path,
) -> int:
    rows: list[dict[str, object]] = []
    for cache in caches:
        for photo in cache.photos:
            key = (cache.platform, cache.platform_id, photo.position)
            st = stats.get(key)
            row: dict[str, object] = dict(photo.fields)
            row.update(
                platform=cache.platform,
                platform_id=cache.platform_id,
                position=photo.position,
                path=paths.get(key),
                width=st.width if st else None,
                height=st.height if st else None,
                aspect=st.aspect if st else None,
                luminance=st.luminance if st else None,
                colorfulness=st.colorfulness if st else None,
                sharpness=st.sharpness if st else None,
                phash=st.phash if st else None,
                model=cache.model,
                ok=photo.ok,
            )
            rows.append(row)
    table = pa.Table.from_pylist(rows, schema=FEATURE_SCHEMA)
    out.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, out, compression="zstd")
    return len(rows)


# --- driver -------------------------------------------------------------------------------


def _read_photos(root: Path) -> dict[tuple[str, str], list[tuple[int, str]]]:
    table = pq.read_table(
        root / "data" / "media.parquet", columns=["platform", "platform_id", "position", "path"]
    )
    grouped: dict[tuple[str, str], list[tuple[int, str]]] = {}
    for row in table.to_pylist():
        if row["path"] is None:
            continue
        grouped.setdefault((row["platform"], row["platform_id"]), []).append(
            (int(row["position"]), row["path"])
        )
    return {key: sorted(photos) for key, photos in sorted(grouped.items())}


def _safe_stats(path: Path) -> ImageStats | None:
    try:
        return image_stats(path)
    except (OSError, UnidentifiedImageError, ValueError):
        return None


def run(  # noqa: PLR0913
    settings: Settings,
    root: Path,
    *,
    model: str | None = None,
    workers: int = 4,
    limit: int | None = None,
    refresh: bool = False,
    transport: httpx.BaseTransport | None = None,
    sleep: Callable[[float], object] = time.sleep,
) -> EnrichResult:
    listings = list(_read_photos(root).items())
    if limit is not None:
        listings = listings[:limit]
    paths: dict[_Key, str] = {
        (platform, platform_id, position): rel
        for (platform, platform_id), photos in listings
        for position, rel in photos
    }
    with httpx.Client(transport=transport) as client, ThreadPoolExecutor(workers) as pool:
        vlm = Vlm(
            client=client,
            base_url=settings.vlm_base_url,
            api_key=settings.vlm_api_key,
            model=model or settings.vlm_model,
            sleep=sleep,
        )
        futures = [
            pool.submit(enrich_listing, vlm, root, platform, platform_id, photos, refresh=refresh)
            for (platform, platform_id), photos in listings
        ]
        stat_futures = {key: pool.submit(_safe_stats, root / rel) for key, rel in paths.items()}
        caches = [f.result() for f in futures]
        stats = {key: f.result() for key, f in stat_futures.items()}
    out = root / "enriched" / "media_features.parquet"
    total = write_media_features(caches, paths, stats, out)
    ok = sum(1 for c in caches for p in c.photos if p.ok)
    return EnrichResult(len(caches), total, ok, total - ok, out)
