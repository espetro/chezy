"""pisos.com detail-page parser against a captured listing page (rent, Gràcia).

This file is the standard the parser has to meet. Golden values in
`fixtures/pisos_detail_rent.golden.json` were read off the captured HTML by hand.
The same parser must also handle sale detail pages; that half of the contract is
checked by a hold-out test the implementer does not see.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

import pytest
from chezy_scraper.models import Listing

pisos = pytest.importorskip("chezy_scraper.adapters.pisos")
PisosAdapter = pisos.PisosAdapter
if not hasattr(PisosAdapter, "parse_detail"):
    pytest.skip("PisosAdapter.parse_detail not implemented yet", allow_module_level=True)

FIXTURES = Path(__file__).parent / "fixtures"
HTML = (FIXTURES / "pisos_detail_rent.html").read_text(encoding="utf-8")
GOLDEN = json.loads((FIXTURES / "pisos_detail_rent.golden.json").read_text(encoding="utf-8"))
NOW = datetime(2026, 9, 20, tzinfo=UTC)


def _parse() -> Listing:
    return PisosAdapter().parse_detail(HTML, operation="rent", scraped_at=NOW)


def test_identity_and_transaction() -> None:
    item = _parse()
    assert item.platform == "pisos"
    assert item.operation == "rent"
    assert item.scraped_at == NOW
    assert item.platform_id == GOLDEN["platform_id"]
    assert item.url == GOLDEN["url"]
    assert item.title == GOLDEN["title"]
    assert item.price_eur == GOLDEN["price_eur"]
    assert item.price_period == GOLDEN["price_period"]
    assert item.property_type == GOLDEN["property_type"]


def test_characteristics() -> None:
    item = _parse()
    assert item.built_m2 == GOLDEN["built_m2"]
    assert item.usable_m2 == GOLDEN["usable_m2"]
    assert item.rooms == GOLDEN["rooms"]
    assert item.bathrooms == GOLDEN["bathrooms"]
    assert item.furnished == GOLDEN["furnished"]
    # Every "Label: value" pair under Características is kept verbatim, keyed by label.
    for label, value in cast("dict[str, str]", GOLDEN["raw_features"]).items():
        assert item.raw_features.get(label) == value, label


def test_energy_certificate() -> None:
    item = _parse()
    assert item.energy_consumption_label == GOLDEN["energy_consumption_label"]
    assert item.energy_consumption_value == GOLDEN["energy_consumption_value"]
    assert item.energy_emissions_label == GOLDEN["energy_emissions_label"]
    assert item.energy_emissions_value == GOLDEN["energy_emissions_value"]


def test_location() -> None:
    item = _parse()
    assert item.neighbourhood == GOLDEN["neighbourhood"]
    assert item.district == GOLDEN["district"]
    assert item.municipality == GOLDEN["municipality"]
    assert item.lat is not None
    assert math.isclose(item.lat, cast("float", GOLDEN["lat"]), abs_tol=1e-6)
    assert item.lon is not None
    assert math.isclose(item.lon, cast("float", GOLDEN["lon"]), abs_tol=1e-6)


def test_publisher() -> None:
    item = _parse()
    assert item.publisher is not None
    assert item.publisher.name == GOLDEN["publisher_name"]
    assert item.publisher.kind == GOLDEN["publisher_kind"]
    assert item.publisher.phone is not None
    assert item.publisher.phone.replace(" ", "").endswith(GOLDEN["publisher_phone_suffix"])


def test_media_is_deduplicated_full_size_photos() -> None:
    item = _parse()
    urls = [m.url for m in item.media]
    assert len(urls) >= GOLDEN["min_photos"]
    assert len(urls) == len(set(urls)), "one Media entry per photo, not per size variant"
    assert all(u.startswith("https://fotos.imghs.net/") for u in urls)
    assert urls[0].endswith(GOLDEN["first_photo_suffix"])
    assert all(m.kind == "photo" for m in item.media)


def test_description_is_the_spanish_text_only() -> None:
    item = _parse()
    assert item.description is not None
    assert item.description.startswith(GOLDEN["description_prefix"])
    assert "Traducciones disponibles" not in item.description
    assert item.source_raw
