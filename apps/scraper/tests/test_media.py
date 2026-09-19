"""Media mirror: selection, naming, transcoding, manifest. No network."""

from __future__ import annotations

import io
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from chezy_scraper.media import (
    MAX_PHOTOS,
    MediaRootUnavailableError,
    ensure_root,
    mirror,
    read_manifest,
    relative_path,
    select_media,
    slug,
    transcode,
    write_manifest,
)
from chezy_scraper.models import Listing, Media
from PIL import Image


def _jpeg(width: int, height: int) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), (120, 90, 60)).save(out, format="JPEG")
    return out.getvalue()


def _listing(media: list[Media]) -> Listing:
    return Listing(
        platform="fotocasa",
        platform_id="42",
        url="https://x.test/42",
        scraped_at=datetime(2026, 9, 19, tzinfo=UTC),
        operation="rent",
        media=media,
    )


def test_select_caps_photos_and_keeps_every_plan() -> None:
    photos = [Media(url=f"https://x.test/{i}.jpg") for i in range(40)]
    plans = [
        Media(url="https://x.test/plan1.jpg", kind="plan"),
        Media(url="https://x.test/plan2.jpg", kind="plan"),
    ]
    videos = [Media(url="https://x.test/v", kind="video")]
    chosen = select_media(_listing([*photos, *videos, *plans]))
    assert len(chosen) == MAX_PHOTOS + 2
    assert all(m.kind in {"photo", "plan"} for m in chosen)


def test_relative_path_is_lowercase_and_carries_room_type() -> None:
    listing = _listing([])
    assert (
        relative_path(listing, 3, Media(url="u", room_type="Living Room"))
        == "fotocasa/42/03-living-room.webp"
    )
    assert relative_path(listing, 1, Media(url="u", kind="plan")) == "fotocasa/42/01-plan.webp"
    assert relative_path(listing, 2, Media(url="u")) == "fotocasa/42/02-photo.webp"
    assert slug("Baño / WC") == "ba-o-wc"


def test_transcode_downscales_long_edge_and_never_upscales() -> None:
    big = Image.open(io.BytesIO(transcode(_jpeg(3000, 2000))))
    assert big.format == "WEBP"
    assert max(big.size) == 1280
    small = Image.open(io.BytesIO(transcode(_jpeg(400, 300))))
    assert small.size == (400, 300)


def test_mirror_downloads_skips_existing_and_records_manifest(tmp_path: Path) -> None:
    hits: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        hits.append(str(request.url))
        if "bad" in str(request.url):
            return httpx.Response(404)
        return httpx.Response(200, content=_jpeg(1600, 1200))

    client = httpx.Client(transport=httpx.MockTransport(handler))
    listing = _listing(
        [
            Media(url="https://x.test/a.jpg", room_type="kitchen"),
            Media(url="https://x.test/bad.jpg", room_type="hall"),
        ]
    )
    manifest, stats = mirror([listing], tmp_path, client=client)
    assert (stats.downloaded, stats.failed, stats.skipped_existing) == (1, 1, 0)
    assert (tmp_path / "fotocasa/42/01-kitchen.webp").exists()
    assert [f.path for f in manifest[("fotocasa", "42")]] == ["fotocasa/42/01-kitchen.webp"]

    hits.clear()
    _, again = mirror([listing], tmp_path, client=client)
    assert again.skipped_existing == 1
    assert hits == ["https://x.test/bad.jpg"]

    write_manifest(tmp_path, manifest)
    assert read_manifest(tmp_path)[("fotocasa", "42")][0].url == "https://x.test/a.jpg"


def test_unmounted_volume_is_refused(tmp_path: Path) -> None:
    with pytest.raises(MediaRootUnavailableError):
        ensure_root(Path("/Volumes/definitely-not-mounted-xyz/chezy/media"))
    ensure_root(tmp_path / "media")
    assert (tmp_path / "media").is_dir()
