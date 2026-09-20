"""Hold-out 2: a live pisos.com detail page whose Características block has bare rows.

Rows such as "Calefacción" or "Aire acondicionado" appear without a value. The
first merged parser coerced the bare "Calefacción" row into `heating=True` and
pydantic rejected the whole listing. The energy certificate is "En trámite" (no
letters), and the listing sits outside Barcelona, which the portal pads results with.
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
HTML = (FIXTURES / "pisos_detail_bare_rows.html").read_text(encoding="utf-8")
GOLDEN = json.loads((FIXTURES / "pisos_detail_bare_rows.golden.json").read_text(encoding="utf-8"))
NOW = datetime(2026, 9, 20, tzinfo=UTC)


def _parse() -> Listing:
    return PisosAdapter().parse_detail(HTML, operation="rent", scraped_at=NOW)


def test_bare_rows_do_not_break_validation() -> None:
    item = _parse()
    assert item.platform_id == GOLDEN["platform_id"]
    assert item.url == GOLDEN["url"]
    assert item.title == GOLDEN["title"]
    assert item.price_eur == GOLDEN["price_eur"]
    assert item.price_period == GOLDEN["price_period"]
    assert item.property_type == GOLDEN["property_type"]
    assert item.heating is None or isinstance(item.heating, str)


def test_bare_rows_characteristics() -> None:
    item = _parse()
    assert item.built_m2 == GOLDEN["built_m2"]
    assert item.usable_m2 == GOLDEN["usable_m2"]
    assert item.rooms == GOLDEN["rooms"]
    assert item.bathrooms == GOLDEN["bathrooms"]
    assert item.furnished == GOLDEN["furnished"]
    for label, value in cast("dict[str, str]", GOLDEN["raw_features"]).items():
        assert item.raw_features.get(label) == value, label
    for label in cast("list[str]", GOLDEN["raw_features_true"]):
        assert item.raw_features.get(label) is True, label


def test_bare_rows_energy_in_progress_has_no_labels() -> None:
    item = _parse()
    assert item.energy_consumption_label == GOLDEN["energy_consumption_label"]
    assert item.energy_emissions_label == GOLDEN["energy_emissions_label"]


def test_bare_rows_location_publisher_media_description() -> None:
    item = _parse()
    assert item.lat is not None
    assert math.isclose(item.lat, cast("float", GOLDEN["lat"]), abs_tol=1e-6)
    assert item.lon is not None
    assert math.isclose(item.lon, cast("float", GOLDEN["lon"]), abs_tol=1e-6)
    assert item.publisher is not None
    assert item.publisher.phone is not None
    assert item.publisher.phone.replace(" ", "").endswith(GOLDEN["publisher_phone_suffix"])
    urls = [m.url for m in item.media]
    assert len(urls) >= GOLDEN["min_photos"]
    assert len(urls) == len(set(urls))
    assert item.description is not None
    assert item.description.startswith(GOLDEN["description_prefix"])
