"""pisos.com adapter against a captured search page (rent, Barcelona Capital).

This file is the standard the adapter has to meet. Golden values in
`fixtures/pisos_rent.golden.json` were read off the captured HTML by hand.
The same adapter must also parse the sale listing pages of the portal; that
half of the contract is checked by a hold-out test the implementer does not see.
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
HTML = (FIXTURES / "pisos_rent.html").read_text(encoding="utf-8")
GOLDEN = json.loads((FIXTURES / "pisos_rent.golden.json").read_text(encoding="utf-8"))
NOW = datetime(2026, 9, 20, tzinfo=UTC)
BCN_LAT = (41.3, 41.5)
BCN_LON = (2.0, 2.3)
MIN_SALE_PRICE_EUR = 50_000


def _parse() -> SearchPage:
    return PisosAdapter().parse_list(HTML, operation="rent", scraped_at=NOW)


def _by_id(listings: list[Listing], platform_id: str) -> Listing:
    matches = [item for item in listings if item.platform_id == platform_id]
    assert len(matches) == 1, f"expected exactly one listing with platform_id={platform_id!r}"
    return matches[0]


def test_search_url_covers_both_operations() -> None:
    adapter = PisosAdapter()
    assert adapter.platform == "pisos"
    assert (
        adapter.search_url("rent", 1) == "https://www.pisos.com/alquiler/pisos-barcelona_capital/"
    )
    assert (
        adapter.search_url("rent", 2) == "https://www.pisos.com/alquiler/pisos-barcelona_capital/2/"
    )
    assert adapter.search_url("sale", 1) == "https://www.pisos.com/venta/pisos-barcelona_capital/"
    assert adapter.search_url("sale", 3) == "https://www.pisos.com/venta/pisos-barcelona_capital/3/"


def test_parse_list_returns_every_card() -> None:
    page = _parse()
    # Every `div.ad-preview[id]` on the page counts, including the zone-specialist
    # block above the main grid. "30 de 907 resultados" is the grid, not the cards.
    assert len(page.listings) == GOLDEN["card_count"]
    assert len({item.platform_id for item in page.listings}) == GOLDEN["card_count"]
    assert page.total_count == GOLDEN["total_count"]
    assert page.payload, "raw payload must be kept for raw/<platform> persistence"


def test_every_listing_has_the_rent_invariants() -> None:
    page = _parse()
    for item in page.listings:
        assert item.platform == "pisos"
        assert item.operation == "rent"
        assert item.url.startswith("https://www.pisos.com/alquilar/"), item.url
        assert item.scraped_at == NOW
        assert item.price_eur is not None, item.platform_id
        assert item.price_eur > 0, item.platform_id
        assert item.price_period == "month", item.platform_id
        assert item.municipality == "Barcelona", item.platform_id
        assert item.title, item.platform_id
        assert item.media, item.platform_id
        assert item.media[0].url.startswith("https://fotos.imghs.net/"), item.platform_id
        assert item.lat is not None, item.platform_id
        assert BCN_LAT[0] < item.lat < BCN_LAT[1], (item.platform_id, item.lat)
        assert item.lon is not None, item.platform_id
        assert BCN_LON[0] < item.lon < BCN_LON[1], (item.platform_id, item.lon)
        assert item.source_raw, item.platform_id


@pytest.mark.parametrize("golden", GOLDEN["listings"], ids=lambda g: g["platform_id"])
def test_golden_listings(golden: dict[str, object]) -> None:
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
    assert item.municipality == golden["municipality"]
    assert item.lat is not None
    assert math.isclose(item.lat, cast("float", golden["lat"]), abs_tol=1e-6)
    assert item.lon is not None
    assert math.isclose(item.lon, cast("float", golden["lon"]), abs_tol=1e-6)
    assert item.media[0].url == golden["first_photo"]
    # The floor label is kept verbatim in raw_features; normalising it is not required.
    assert item.raw_features.get("floor") == golden["floor_raw"]
