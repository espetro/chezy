"""Build a shareable dataset bundle: data files, images, datacard, checksums, one `.tar.gz`.

Layout inside the archive (paths in the data files are relative to the archive root)::

    chezy-<tier>-<release>/
      DATASET.md  MANIFEST.json  SHA256SUMS
      data/listings.jsonl  listings.parquet  media.parquet
      schema/listing.schema.json
      media/<platform>/<platform_id>/<nn>-<room>.webp

Personal data is scrubbed by default: publisher phone and email are dropped, phone numbers and
emails inside free text are masked, and `source_raw` (which repeats them) is emptied.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import tarfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Final, Literal

from chezy_scraper.models import Listing
from chezy_scraper.tables import write_tables

if TYPE_CHECKING:
    from collections.abc import Iterable

    from chezy_scraper.media import MediaFile

Pii = Literal["scrub", "keep"]

_EMAIL: Final = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# Spanish numbers: optional +34, then 9 digits that may be grouped by spaces, dots or dashes.
_PHONE: Final = re.compile(r"(?<!\d)(?:\+?34[ .-]?)?[6-9](?:[ .-]?\d){8}(?!\d)")
_MASK_EMAIL: Final = "[email removed]"
_MASK_PHONE: Final = "[phone removed]"
_MEDIA_PREFIX: Final = "media/"


@dataclass(frozen=True)
class BundleResult:
    directory: Path
    archive: Path
    listings: int
    images: int
    missing_images: int
    archive_bytes: int


def scrub_text(value: str | None) -> str | None:
    if value is None:
        return None
    return _PHONE.sub(_MASK_PHONE, _EMAIL.sub(_MASK_EMAIL, value))


def scrub(listing: Listing, *, keep_raw: bool = False) -> Listing:
    """Copy of `listing` without contact details; free text is masked, not deleted."""
    publisher = listing.publisher
    if publisher is not None:
        publisher = publisher.model_copy(update={"phone": None, "email": None})
    return listing.model_copy(
        update={
            "publisher": publisher,
            "title": scrub_text(listing.title),
            "description": scrub_text(listing.description),
            "source_raw": listing.source_raw if keep_raw else {},
        }
    )


def with_local_paths(listing: Listing, files: Iterable[MediaFile]) -> Listing:
    """Fill `Media.local_path` (archive relative, `media/...`) from mirrored files by url."""
    by_url = {f.url: f"{_MEDIA_PREFIX}{f.path}" for f in files}
    media = [m.model_copy(update={"local_path": by_url.get(m.url)}) for m in listing.media]
    return listing.model_copy(update={"media": media})


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


def _write_checksums(root: Path) -> int:
    lines = [
        f"{_sha256(p)}  {p.relative_to(root).as_posix()}"
        for p in sorted(root.rglob("*"))
        if p.is_file() and p.name != "SHA256SUMS"
    ]
    (root / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(lines)


def _datacard(
    *, tier: str, release: str, pii: Pii, counts: Counter[str], images: int, missing: int
) -> str:
    table = "\n".join(f"| {key} | {value} |" for key, value in sorted(counts.items()))
    pii_note = (
        "Publisher phone and email are removed, phone numbers and emails found in titles and "
        "descriptions are masked, and `source_raw` is empty."
        if pii == "scrub"
        else "Contact details are included as scraped. Do not redistribute outside the team."
    )
    return f"""# Chezy listings dataset: {tier} ({release})

Barcelona rent and sale listings scraped from Spanish property portals, with text, structured
attributes, coordinates and photos, meant for developing and testing agentic workflows.

## What is inside

| platform and operation | listings |
|---|---|
{table}

Images: {images} WebP files ({missing} could not be downloaded and have no path).
Each platform and operation slice is the first N listings of the portal's default ranking, so
this is a convenient sample, not a random sample of the market.

## Files

| path | what |
|---|---|
| `data/listings.parquet` | one row per listing, typed columns; load with polars or pandas |
| `data/listings.jsonl` | same listings as nested JSON, including a `media` array |
| `data/media.parquet` | one row per image: keys, position, kind, room_type, url, path |
| `schema/listing.schema.json` | JSON Schema of one JSONL line |
| `media/<platform>/<platform_id>/<nn>-<room>.webp` | photos, at most 1280 px, quality 80 |
| `SHA256SUMS` | checksums of every file; check with `shasum -a 256 -c SHA256SUMS` |

Join key everywhere: `(platform, platform_id)`. Images are plain files, never embedded in the
tables. `media.path` and `Media.local_path` are object keys relative to the archive root, so the
`media/` tree can stay on disk or be uploaded to S3 or R2 unchanged (key = path).

## Loading

```python
import polars as pl

listings = pl.read_parquet("data/listings.parquet")
media = pl.read_parquet("data/media.parquet")
photos = media.filter(pl.col("path").is_not_null())
```

`raw_features` and `source_raw` are JSON strings in Parquet (`json.loads` them) and objects in
the JSONL.

## Personal data

{pii_note}

## Known data quality caveats

Nothing here is deduplicated or validated yet. Expect:

- The same flat listed on several portals (fotocasa and habitaclia overlap heavily).
- Placeholder values: `built_m2 = 1` on some milanuncios ads, `bathrooms = 0` next to
  bedrooms, price 0 on "we buy your flat" ads.
- `is_temporary_rental` is reliable on fotocasa only; it is often null elsewhere.
- `location_accuracy` is a per portal heuristic. Fotocasa `zone` pins are usually within about
  20 m of the street pin.

Scraped from public listing pages for internal development. Respect each portal's terms.
"""


def _copy_images(prepared: list[Listing], *, media_root: Path, root: Path) -> tuple[int, int]:
    """Copy mirrored files into the bundle; clear `local_path` where the file is absent."""
    copied = missing = 0
    for listing in prepared:
        for media in listing.media:
            relative = media.local_path
            source = media_root / relative.removeprefix(_MEDIA_PREFIX) if relative else None
            if relative is None or source is None or not source.exists():
                missing += 1
                media.local_path = None
                continue
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            copied += 1
    return copied, missing


def build_bundle(  # noqa: PLR0913
    listings: list[Listing],
    manifest: dict[tuple[str, str], list[MediaFile]],
    *,
    media_root: Path,
    out_root: Path,
    tier: str,
    release: str,
    pii: Pii = "scrub",
    created_at: datetime | None = None,
) -> BundleResult:
    """Write `<out_root>/chezy-<tier>-<release>/` and `<...>.tar.gz` next to it."""
    name = f"chezy-{tier}-{release}"
    root = out_root / name
    if root.exists():
        shutil.rmtree(root)
    (root / "data").mkdir(parents=True)
    (root / "schema").mkdir()

    prepared = [
        with_local_paths(
            scrub(listing) if pii == "scrub" else listing,
            manifest.get((listing.platform, listing.platform_id), []),
        )
        for listing in listings
    ]
    images, missing = _copy_images(prepared, media_root=media_root, root=root)

    with (root / "data" / "listings.jsonl").open("w", encoding="utf-8") as handle:
        for listing in prepared:
            handle.write(listing.model_dump_json() + "\n")
    write_tables(prepared, root / "data")
    (root / "schema" / "listing.schema.json").write_text(
        json.dumps(Listing.model_json_schema(), indent=2) + "\n", encoding="utf-8"
    )

    counts = Counter(f"{x.platform} {x.operation}" for x in prepared)
    (root / "DATASET.md").write_text(
        _datacard(
            tier=tier, release=release, pii=pii, counts=counts, images=images, missing=missing
        ),
        encoding="utf-8",
    )
    (root / "MANIFEST.json").write_text(
        json.dumps(
            {
                "name": name,
                "tier": tier,
                "release": release,
                "created_at": (created_at or datetime.now().astimezone()).isoformat(),
                "pii": pii,
                "listings": dict(counts),
                "images": images,
                "images_missing": missing,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    _write_checksums(root)

    archive = out_root / f"{name}.tar.gz"
    with tarfile.open(archive, "w:gz", compresslevel=6) as tar:
        tar.add(root, arcname=name)
    return BundleResult(
        directory=root,
        archive=archive,
        listings=len(prepared),
        images=images,
        missing_images=missing,
        archive_bytes=archive.stat().st_size,
    )
