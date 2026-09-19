"""Adapters parse committed HTML fixtures offline; no network."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from chezy_scraper.adapters.base import (
    PayloadNotFoundError,
    extract_js_json_parse,
    extract_script_json,
)
from chezy_scraper.adapters.fotocasa import FotocasaAdapter
from chezy_scraper.adapters.habitaclia import HabitacliaAdapter
from chezy_scraper.models import Operation
from chezy_scraper.vocab import AMENITIES

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 9, 19, tzinfo=UTC)


def _read(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_fotocasa_urls() -> None:
    adapter = FotocasaAdapter()
    assert adapter.search_url("rent", 1).endswith(
        "/es/alquiler/viviendas/barcelona-capital/todas-las-zonas/l"
    )
    assert adapter.search_url("sale", 3).endswith(
        "/comprar/viviendas/barcelona-capital/todas-las-zonas/l/3"
    )


def test_habitaclia_urls() -> None:
    adapter = HabitacliaAdapter()
    assert adapter.search_url("rent", 1).endswith(
        "/alquiler/viviendas/barcelona-provincia/barcelona-capital/s"
    )
    assert adapter.search_url("sale", 2).endswith(
        "/comprar/viviendas/barcelona-provincia/barcelona-capital/s/2"
    )


@pytest.mark.parametrize(
    ("name", "operation"), [("fotocasa_rent.html", "rent"), ("fotocasa_sale.html", "sale")]
)
def test_fotocasa_listings(name: str, operation: Operation) -> None:
    page = FotocasaAdapter().parse_list(_read(name), operation=operation, scraped_at=NOW)
    assert len(page.listings) == 4
    assert page.total_count is not None
    assert page.total_pages is not None
    assert page.total_pages > 1
    for listing in page.listings:
        assert listing.platform == "fotocasa"
        assert listing.operation == operation
        assert listing.price_period == ("month" if operation == "rent" else "total")
        assert listing.price_eur is not None
        assert listing.lat is not None
        assert listing.lon is not None
        assert listing.description
        assert listing.rooms is not None
        assert listing.built_m2 is not None
        assert listing.price_per_m2 is not None
        assert listing.url.startswith("https://www.fotocasa.es/es/")
        assert "?" not in listing.url
        assert len([m for m in listing.media if m.kind == "photo"]) >= 10
        assert set(listing.amenities) <= AMENITIES
        assert listing.source_raw["id"] is not None


def test_fotocasa_rent_first_listing_details() -> None:
    first = (
        FotocasaAdapter()
        .parse_list(_read("fotocasa_rent.html"), operation="rent", scraped_at=NOW)
        .listings[0]
    )
    assert first.platform_id == "190841520"
    assert first.price_eur == 10000
    assert first.rooms == 3
    assert first.bathrooms == 3
    assert first.built_m2 == 299
    assert first.is_temporary_rental is True
    assert first.property_subtype == "penthouse"
    assert first.district == "Sant Martí"
    assert first.municipality == "Barcelona"
    assert first.furnished is True
    assert {"elevator", "terrace", "pool", "doorman", "exterior", "sea_view"} <= set(
        first.amenities
    )
    assert first.media[0].room_type == "swimming pool"
    assert first.publisher is not None
    assert first.publisher.kind == "professional"
    assert first.published_at is not None


def test_fotocasa_price_drop_parses_display_price() -> None:
    page = FotocasaAdapter().parse_list(
        _read("fotocasa_rent.html"), operation="rent", scraped_at=NOW
    )
    assert page.listings[2].price_eur == 6900
    assert page.listings[2].price_drop_eur == 1000


@pytest.mark.parametrize(
    ("name", "operation"), [("habitaclia_rent.html", "rent"), ("habitaclia_sale.html", "sale")]
)
def test_habitaclia_listings(name: str, operation: Operation) -> None:
    page = HabitacliaAdapter().parse_list(_read(name), operation=operation, scraped_at=NOW)
    assert len(page.listings) == 4
    assert page.total_count is not None
    assert page.total_pages is not None
    assert page.total_pages > 1
    for listing in page.listings:
        assert listing.platform == "habitaclia"
        assert listing.operation == operation
        assert listing.price_eur is not None
        assert listing.rooms is not None
        assert listing.bathrooms is not None
        assert listing.built_m2 is not None
        assert listing.street is not None
        assert listing.street_number is not None
        assert listing.lat is not None
        assert listing.description
        assert listing.updated_at is not None
        assert listing.url.startswith("https://www.habitaclia.com/i")
        assert len([m for m in listing.media if m.kind == "photo"]) >= 10
    # The source occasionally serves an empty title; most listings carry one.
    assert sum(1 for listing in page.listings if listing.title) >= 3


def test_habitaclia_rent_first_listing_details() -> None:
    first = (
        HabitacliaAdapter()
        .parse_list(_read("habitaclia_rent.html"), operation="rent", scraped_at=NOW)
        .listings[0]
    )
    assert first.platform_id == "10636002656060"
    assert first.property_subtype == "penthouse"
    assert first.floor == "penthouse"
    assert first.price_drop_eur == 1000
    assert first.energy_consumption_label == "E"
    assert first.energy_consumption_value == 134
    assert first.energy_emissions_label == "D"
    assert first.location_accuracy == "zone"
    assert first.neighbourhood == "Sant Gervasi- Galvany"
    assert first.street == "FERRAN VALLS I TABERNER"
    assert first.condition == "renovated"
    assert "elevator" in first.amenities
    assert {"parking", "parquet"} <= set(first.amenities)
    assert first.furnished is None  # neither has nor hasNot: unknown, not False
    assert first.updated_at is not None
    assert first.updated_at.tzinfo is not None


def test_missing_payload_raises() -> None:
    with pytest.raises(PayloadNotFoundError):
        extract_script_json("<html></html>", "__initial_props__")
    with pytest.raises(PayloadNotFoundError):
        extract_js_json_parse("<html></html>")


def test_habitaclia_furnished_maps_from_has_and_has_not() -> None:
    page = HabitacliaAdapter().parse_list(
        _read("habitaclia_rent.html"), operation="rent", scraped_at=NOW
    )
    flags = {listing.furnished for listing in page.listings}
    assert True in flags
