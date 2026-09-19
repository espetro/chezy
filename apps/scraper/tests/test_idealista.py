"""Idealista adapter against synthetic fixtures.

The fixtures follow the markup as scouted, not a live capture (idealista is only
reachable through a real Chrome session), so these tests pin parser behaviour, not
today's site.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from chezy_scraper.adapters.idealista import IdealistaAdapter
from chezy_scraper.fetch.browser import RenderedPage
from chezy_scraper.models import Listing

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 9, 19, tzinfo=UTC)

MULTIMEDIA = {
    "fullScreenGalleryPics": [
        {"src": "https://img.idealista.com/1.jpg", "tag": "Cocina", "multimediaId": 1},
        {"src": "https://img.idealista.com/2.jpg", "hoverText": "Salón"},
    ],
    "plans": [{"src": "https://img.idealista.com/plan.jpg"}],
    "videos": [],
    "visit3DTourURL": "https://tour.example/3d",
}


@pytest.fixture
def listing() -> Listing:
    page = RenderedPage(
        url="https://www.idealista.com/inmueble/99569815/",
        html=(FIXTURES / "idealista_detail.html").read_text(encoding="utf-8"),
        globals={"utag_data": {"ad": {"id": "99569815"}}, "adMultimediasInfo": MULTIMEDIA},
    )
    return IdealistaAdapter().parse_detail(page, operation="rent", scraped_at=NOW)


def test_search_urls_paginate_and_keep_shape_query() -> None:
    plain = IdealistaAdapter()
    assert plain.search_url("rent", 1).endswith("/alquiler-viviendas/barcelona-barcelona/")
    assert plain.search_url("sale", 3).endswith("/venta-viviendas/barcelona-barcelona/pagina-3.htm")
    shaped = IdealistaAdapter({"rent": "https://www.idealista.com/alquiler-viviendas/b/?shape=abc"})
    assert shaped.search_url("rent", 2) == (
        "https://www.idealista.com/alquiler-viviendas/b/pagina-2.htm?shape=abc"
    )


def test_list_page_merges_utag_and_dom_ids() -> None:
    page = RenderedPage(
        url="https://www.idealista.com/alquiler-viviendas/barcelona-barcelona/",
        html=(FIXTURES / "idealista_list.html").read_text(encoding="utf-8"),
        globals={
            "utag_data": {
                "list_ads_adId": "99569815,100200300",
                "list_totalResult": "1617",
                "list_totalPageNumber": 54,
            }
        },
    )
    parsed = IdealistaAdapter().parse_list(page)
    assert parsed.ids == ["99569815", "100200300", "100200301"]
    assert (parsed.total_count, parsed.total_pages) == (1617, 54)


def test_detail_core_fields(listing: Listing) -> None:
    assert listing.platform_id == "99569815"
    assert (listing.price_eur, listing.price_period) == (1250.0, "month")
    assert listing.property_type == "piso"
    assert (listing.built_m2, listing.usable_m2) == (85.0, 70.0)
    assert (listing.rooms, listing.bathrooms) == (3, 2)
    assert listing.floor == "3"
    assert listing.orientation == "sur, este"
    assert listing.year_built == 1965
    assert listing.condition == "good"
    assert listing.furnished is True
    assert listing.heating is not None
    assert listing.heating.lower().startswith("calefacción individual")
    assert listing.description == "Luminoso piso reformado.\nCerca del metro."


def test_detail_location_and_energy(listing: Listing) -> None:
    assert (listing.street, listing.street_number) == ("Calle de Mallorca", "123")
    assert listing.neighbourhood == "La Dreta de l'Eixample"
    assert listing.district == "Eixample"
    assert listing.municipality == "Barcelona"
    assert (listing.lat, listing.lon) == (41.3922, 2.1587)
    assert listing.location_accuracy == "street"
    assert (listing.energy_consumption_label, listing.energy_consumption_value) == ("E", 145.0)
    assert listing.energy_emissions_label == "B"
    assert listing.energy_emissions_value == 23.0


def test_detail_amenities_media_publisher(listing: Listing) -> None:
    assert {"elevator", "air_conditioning", "wardrobes", "balcony", "furnished"} <= set(
        listing.amenities
    )
    assert "pool" not in listing.amenities  # "Sin piscina"
    kinds = [(m.kind, m.room_type) for m in listing.media]
    assert kinds == [
        ("photo", "cocina"),
        ("photo", "salón"),
        ("plan", None),
        ("tour_3d", None),
    ]
    assert listing.publisher is not None
    assert (listing.publisher.name, listing.publisher.kind) == ("Finques Example", "professional")
    assert listing.source_raw["ad_multimedias_info"] == MULTIMEDIA


def test_non_detail_url_is_rejected() -> None:
    page = RenderedPage(url="https://www.idealista.com/x/", html="<html></html>")
    with pytest.raises(ValueError, match="not an idealista detail url"):
        IdealistaAdapter().parse_detail(page, operation="rent", scraped_at=NOW)


def test_live_markup_shape_wrapped_lists_seasonal_tag_and_energy() -> None:
    """Real pages wrap each feature list in a div and mark seasonal lets with a tag."""
    page = RenderedPage(
        url="https://www.idealista.com/inmueble/112601389/",
        html=(FIXTURES / "idealista_detail_live.html").read_text(encoding="utf-8"),
        globals={},
    )
    listing = IdealistaAdapter().parse_detail(
        page, operation="rent", scraped_at=datetime(2026, 9, 19, tzinfo=UTC)
    )
    assert listing.built_m2 == 50
    assert listing.bathrooms == 1
    assert listing.is_temporary_rental is True
    assert listing.energy_consumption_label == "G"
    assert listing.neighbourhood == "El Raval"


@pytest.mark.parametrize(
    ("label", "kind"), [("Profesional", "professional"), ("Particular", "private")]
)
def test_publisher_type_label_is_a_kind_not_a_name(label: str, kind: str) -> None:
    html = (FIXTURES / "idealista_detail_live.html").read_text(encoding="utf-8")
    page = RenderedPage(
        url="https://www.idealista.com/inmueble/1/",
        html=html.replace("</body>", f'<div class="about-advertiser-name">{label}</div></body>'),
        globals={},
    )
    listing = IdealistaAdapter().parse_detail(
        page, operation="rent", scraped_at=datetime(2026, 9, 19, tzinfo=UTC)
    )
    assert listing.publisher is not None
    assert (listing.publisher.name, listing.publisher.kind) == (None, kind)
