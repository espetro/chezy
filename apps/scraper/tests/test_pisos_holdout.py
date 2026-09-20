"""Hold-out: pisos.com sale page the implementer never saw.

Sale cards link under /comprar/ and carry a total price with no "/mes" suffix.
Promoted to a regular regression test once the forge run passes.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

import pytest
from chezy_scraper.adapters.base import SearchPage
from chezy_scraper.models import Listing

# Skips (does not error) until the adapter exists, so `main` stays green before the forge run.
pisos = pytest.importorskip("chezy_scraper.adapters.pisos")
PisosAdapter = pisos.PisosAdapter

FIXTURES = Path(__file__).parent / "fixtures"
HTML = (FIXTURES / "pisos_sale.html").read_text(encoding="utf-8")
GOLDEN = json.loads((FIXTURES / "pisos_sale.golden.json").read_text(encoding="utf-8"))
NOW = datetime(2026, 9, 20, tzinfo=UTC)
BCN_LAT = (41.3, 41.5)
BCN_LON = (2.0, 2.3)
MIN_SALE_PRICE_EUR = 50_000


def _parse() -> SearchPage:
    return PisosAdapter().parse_list(HTML, operation="sale", scraped_at=NOW)


def _by_id(listings: list[Listing], platform_id: str) -> Listing:
    matches = [item for item in listings if item.platform_id == platform_id]
    assert len(matches) == 1, f"expected exactly one listing with platform_id={platform_id!r}"
    return matches[0]


def test_sale_page_returns_every_card() -> None:
    page = _parse()
    assert len(page.listings) == GOLDEN["card_count"]
    assert len({item.platform_id for item in page.listings}) == GOLDEN["card_count"]
    assert page.total_count == GOLDEN["total_count"]


def test_sale_urls_use_comprar_and_prices_are_totals() -> None:
    page = _parse()
    for item in page.listings:
        assert item.platform == "pisos"
        assert item.operation == "sale"
        assert item.url.startswith("https://www.pisos.com/comprar/"), item.url
        assert item.price_eur is not None, item.platform_id
        assert item.price_eur > MIN_SALE_PRICE_EUR, (item.platform_id, item.price_eur)
        assert item.price_period == "total", item.platform_id
        assert item.municipality == "Barcelona", item.platform_id
        assert item.lat is not None, item.platform_id
        assert BCN_LAT[0] < item.lat < BCN_LAT[1], (item.platform_id, item.lat)
        assert item.lon is not None, item.platform_id
        assert BCN_LON[0] < item.lon < BCN_LON[1], (item.platform_id, item.lon)


@pytest.mark.parametrize("golden", GOLDEN["listings"], ids=lambda g: g["platform_id"])
def test_sale_golden_listings(golden: dict[str, object]) -> None:
    item = _by_id(_parse().listings, str(golden["platform_id"]))
    assert item.url == golden["url"]
    assert item.price_eur == golden["price_eur"]
    assert item.price_period == golden["price_period"]
    assert item.rooms == golden["rooms"]
    assert item.bathrooms == golden["bathrooms"]
    assert item.built_m2 == golden["built_m2"]
    assert item.property_type == golden["property_type"]
    assert item.title == golden["title"]
    assert item.neighbourhood == golden["neighbourhood"]
    assert item.district == golden["district"]
    assert item.lat is not None
    assert math.isclose(item.lat, cast("float", golden["lat"]), abs_tol=1e-6)
    assert item.lon is not None
    assert math.isclose(item.lon, cast("float", golden["lon"]), abs_tol=1e-6)
    assert item.media[0].url == golden["first_photo"]
    assert item.raw_features.get("floor") == golden["floor_raw"]
