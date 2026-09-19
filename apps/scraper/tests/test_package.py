# pyright: basic
# pyarrow ships partial type information, so strict inference cannot resolve its API.
"""Bundle building: PII scrubbing, relocatable paths, checksums, Parquet round trip."""

from __future__ import annotations

import hashlib
import json
import tarfile
from datetime import UTC, datetime
from pathlib import Path

import pyarrow.parquet as pq
from chezy_scraper.media import MediaFile
from chezy_scraper.models import Listing, Media, Publisher
from chezy_scraper.package import build_bundle, scrub_text


def _listing(platform_id: str = "1") -> Listing:
    return Listing(
        platform="fotocasa",
        platform_id=platform_id,
        url="https://example.test/1",
        scraped_at=datetime(2026, 9, 19, tzinfo=UTC),
        operation="rent",
        price_eur=900,
        rooms=2,
        amenities=["lift"],
        description="Llama al 612 34 56 78 o escribe a ana@example.com para visitar.",
        publisher=Publisher(name="Agencia", phone="931234567", email="a@b.es"),
        media=[
            Media(url="https://img.test/a.jpg", room_type="salon"),
            Media(url="https://img.test/b.jpg"),
        ],
        source_raw={"phone": "931234567"},
    )


def test_scrub_text_masks_phones_and_emails_only() -> None:
    masked = scrub_text("Tel +34 612-345-678, ana@example.com, 2 habitaciones, 1500 EUR")
    assert masked == "Tel [phone removed], [email removed], 2 habitaciones, 1500 EUR"


def test_bundle_round_trip(tmp_path: Path) -> None:
    media_root = tmp_path / "media"
    (media_root / "fotocasa/1").mkdir(parents=True)
    (media_root / "fotocasa/1/01-salon.webp").write_bytes(b"webp")
    manifest = {
        ("fotocasa", "1"): [MediaFile("https://img.test/a.jpg", "fotocasa/1/01-salon.webp")]
    }

    result = build_bundle(
        [_listing()],
        manifest,
        media_root=media_root,
        out_root=tmp_path / "out",
        tier="small",
        release="t1",
    )

    assert (result.listings, result.images, result.missing_images) == (1, 1, 1)
    root = result.directory
    row = json.loads((root / "data/listings.jsonl").read_text(encoding="utf-8"))
    assert row["publisher"]["phone"] is None
    assert row["source_raw"] == {}
    assert "612" not in row["description"]
    assert [m["local_path"] for m in row["media"]] == ["media/fotocasa/1/01-salon.webp", None]
    assert (root / "media/fotocasa/1/01-salon.webp").read_bytes() == b"webp"

    table = pq.read_table(root / "data/listings.parquet")
    assert table.num_rows == 1
    assert table.column("image_count").to_pylist() == [1]
    assert table.column("amenities").to_pylist() == [["lift"]]
    assert pq.read_table(root / "data/media.parquet").num_rows == 2

    for line in (root / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, relative = line.split("  ", maxsplit=1)
        assert hashlib.sha256((root / relative).read_bytes()).hexdigest() == digest
    with tarfile.open(result.archive) as tar:
        assert "chezy-small-t1/DATASET.md" in tar.getnames()
