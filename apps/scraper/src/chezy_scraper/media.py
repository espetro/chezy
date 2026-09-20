"""Image mirror: download, transcode to WebP, and record a relocatable manifest.

Target layout: <media_root>/<platform>/<listing_id>/<nn>-<room_type>.webp

- WebP, 1280 px long edge, quality 80 (~130 KB/image): keeps floor, wall and
  window texture legible for vision experiments while fitting the volume.
- At most 25 photos per listing, plus every floor plan (few, high value).
- `room_type` from the source is carried into the filename so vision work gets
  free weak labels.
- `media_manifest.jsonl` (paths relative to the media root) lets the dataset move
  volumes without a re-scrape.
"""

from __future__ import annotations

import io
import json
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final

import httpx
from PIL import Image, UnidentifiedImageError

from chezy_scraper.jsonx import arr, obj, text

if TYPE_CHECKING:
    from collections.abc import Iterable

    from chezy_scraper.models import Listing, Media

MAX_PHOTOS: Final = 25
LONG_EDGE: Final = 1280
WEBP_QUALITY: Final = 80
MANIFEST_NAME: Final = "media_manifest.jsonl"
_SLUG = re.compile(r"[^a-z0-9]+")
_VOLUMES = Path("/Volumes")


class MediaRootUnavailableError(RuntimeError):
    """The media root sits on a volume that is not mounted."""


@dataclass(frozen=True)
class MediaFile:
    url: str
    path: str  # relative to the media root


@dataclass(frozen=True)
class MediaStats:
    listings: int
    downloaded: int
    skipped_existing: int
    failed: int


def ensure_root(root: Path) -> None:
    """Refuse to create a tree under a `/Volumes/<name>` that is not mounted."""
    if root.is_relative_to(_VOLUMES) and len(root.parts) > len(_VOLUMES.parts):
        volume = _VOLUMES / root.parts[len(_VOLUMES.parts)]
        if not volume.exists():
            msg = f"{volume} is not mounted; refusing to create {root}"
            raise MediaRootUnavailableError(msg)
    root.mkdir(parents=True, exist_ok=True)


def slug(value: str | None) -> str:
    return _SLUG.sub("-", (value or "").lower()).strip("-") or "photo"


def select_media(listing: Listing) -> list[Media]:
    """<= 25 photos plus all floor plans, in source order."""
    photos = [m for m in listing.media if m.kind == "photo"][:MAX_PHOTOS]
    plans = [m for m in listing.media if m.kind == "plan"]
    return [*photos, *plans]


def relative_path(listing: Listing, index: int, media: Media) -> str:
    label = "plan" if media.kind == "plan" else slug(media.room_type)
    return f"{listing.platform}/{listing.platform_id}/{index:02d}-{label}.webp"


def transcode(data: bytes) -> bytes:
    """Downscale to `LONG_EDGE` (never upscale) and encode as WebP."""
    with Image.open(io.BytesIO(data)) as image:
        converted = image.convert("RGBA" if image.mode in {"RGBA", "LA", "P"} else "RGB")
        converted.thumbnail((LONG_EDGE, LONG_EDGE), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        converted.save(out, format="WEBP", quality=WEBP_QUALITY, method=4)
        return out.getvalue()


def _mirror_one(
    client: httpx.Client, root: Path, listing: Listing, index: int, media: Media
) -> tuple[MediaFile | None, str]:
    rel = relative_path(listing, index, media)
    dest = root / rel
    if dest.exists() and dest.stat().st_size > 0:
        return MediaFile(media.url, rel), "skipped"
    try:
        response = client.get(media.url)
        response.raise_for_status()
        payload = transcode(response.content)
    except (httpx.HTTPError, UnidentifiedImageError, OSError):
        return None, "failed"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(payload)
    return MediaFile(media.url, rel), "downloaded"


def mirror(
    listings: Iterable[Listing],
    root: Path,
    *,
    client: httpx.Client | None = None,
    workers: int = 6,
) -> tuple[dict[tuple[str, str], list[MediaFile]], MediaStats]:
    """Mirror images for `listings`. Idempotent: existing files are kept."""
    ensure_root(root)
    http = client or httpx.Client(timeout=30, follow_redirects=True)
    manifest: dict[tuple[str, str], list[MediaFile]] = {}
    counts = {"downloaded": 0, "skipped": 0, "failed": 0}
    items = list(listings)
    try:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for listing in items:
                jobs = [
                    pool.submit(_mirror_one, http, root, listing, index, media)
                    for index, media in enumerate(select_media(listing), start=1)
                ]
                files: list[MediaFile] = []
                for job in jobs:
                    mirrored, outcome = job.result()
                    counts[outcome] += 1
                    if mirrored is not None:
                        files.append(mirrored)
                manifest[(listing.platform, listing.platform_id)] = files
    finally:
        if client is None:
            http.close()
    stats = MediaStats(
        listings=len(items),
        downloaded=counts["downloaded"],
        skipped_existing=counts["skipped"],
        failed=counts["failed"],
    )
    return manifest, stats


def write_manifest(root: Path, manifest: dict[tuple[str, str], list[MediaFile]]) -> None:
    """Merge `manifest` into `<root>/media_manifest.jsonl` (one line per listing)."""
    merged = read_manifest(root)
    merged.update(manifest)
    path = root / MANIFEST_NAME
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        for (platform, platform_id), files in sorted(merged.items()):
            record = {
                "platform": platform,
                "platform_id": platform_id,
                "files": [{"url": f.url, "path": f.path} for f in files],
            }
            handle.write(json.dumps(record) + "\n")
    tmp.replace(path)


def read_manifest(root: Path) -> dict[tuple[str, str], list[MediaFile]]:
    path = root / MANIFEST_NAME
    out: dict[tuple[str, str], list[MediaFile]] = {}
    if not path.exists():
        return out
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            record = obj(json.loads(line))
            files = [
                MediaFile(url=url, path=rel)
                for raw in arr(record.get("files"))
                if (url := text(obj(raw).get("url"))) and (rel := text(obj(raw).get("path")))
            ]
            out[(str(record["platform"]), str(record["platform_id"]))] = files
    return out
