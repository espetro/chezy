"""Postgres loader against a throwaway schema on pg0; skipped when pg0 is not running."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import uuid4

import psycopg
import pytest
from chezy_scraper.config import Settings
from chezy_scraper.media import MediaFile
from chezy_scraper.models import Listing, Media, Publisher
from chezy_scraper.sinks import postgres
from psycopg import sql


@pytest.fixture
def conn() -> Iterator[psycopg.Connection]:
    try:
        connection = psycopg.connect(Settings.from_env().database_url, connect_timeout=2)
    except psycopg.OperationalError:
        pytest.skip("pg0 is not running (mise run db:start)")
    schema = sql.Identifier(f"scraper_test_{uuid4().hex[:8]}")
    connection.execute(sql.SQL("create schema {}").format(schema))
    connection.execute(sql.SQL("set search_path to {}").format(schema))
    connection.commit()
    try:
        yield connection
    finally:
        connection.rollback()
        connection.execute(sql.SQL("drop schema {} cascade").format(schema))
        connection.commit()
        connection.close()


def _listing(price: float) -> Listing:
    return Listing(
        platform="fotocasa",
        platform_id="1",
        url="https://x.test/1",
        scraped_at=datetime(2026, 9, 19, tzinfo=UTC),
        operation="rent",
        price_eur=price,
        amenities=["lift", "terrace"],
        raw_features={"a": [1, 2]},
        publisher=Publisher(name="Agency", kind="professional"),
        media=[Media(url="https://x.test/a.jpg", room_type="kitchen")],
    )


def test_load_is_idempotent_and_applies_manifest(conn: psycopg.Connection) -> None:
    manifest = {
        ("fotocasa", "1"): [MediaFile("https://x.test/a.jpg", "fotocasa/1/01-kitchen.webp")]
    }
    assert postgres.load(conn, [_listing(900)], manifest) == 1
    assert postgres.load(conn, [_listing(950)], manifest) == 1
    row = conn.execute(
        "select price_eur, amenities, publisher_name, raw_features->'a' from listings"
    ).fetchall()
    assert row == [(950.0, ["lift", "terrace"], "Agency", [1, 2])]
    media = conn.execute("select position, local_path from listing_media").fetchall()
    assert media == [(1, "fotocasa/1/01-kitchen.webp")]
