"""milanuncios adapter against a trimmed real payload (rent, Barcelona)."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from chezy_scraper.adapters.milanuncios import MilanunciosAdapter

HTML = (Path(__file__).parent / "fixtures" / "milanuncios_rent.html").read_text(encoding="utf-8")
NOW = datetime(2026, 9, 19, tzinfo=UTC)


def test_search_url_paginates_with_query() -> None:
    adapter = MilanunciosAdapter()
    assert adapter.search_url("rent", 1).endswith("/alquiler-de-pisos-en-barcelona-barcelona/")
    assert adapter.search_url("sale", 3).endswith(
        "/venta-de-pisos-en-barcelona-barcelona/?pagina=3"
    )


def test_parse_list_maps_ads_to_canonical() -> None:
    page = MilanunciosAdapter().parse_list(HTML, operation="rent", scraped_at=NOW)
    assert (page.total_count, page.total_pages) == (2270, 56)
    assert len(page.listings) == 4
    listing = page.listings[1]
    assert listing.platform_id == "568615690"
    assert listing.url.startswith("https://www.milanuncios.com/alquiler-de-pisos-")
    assert (listing.price_eur, listing.price_period) == (3397.0, "month")
    assert (listing.rooms, listing.bathrooms, listing.built_m2) == (3, 2, 70.0)
    assert listing.municipality == "Barcelona"
    assert listing.published_at is not None
    assert all(m.url.startswith("https://images-re.milanuncios.com/") for m in listing.media)
    assert len(listing.media) == 6
    assert listing.publisher is not None
    assert listing.publisher.kind == "professional"
    assert listing.raw_features["origin"] == {"name": "inner", "provider": "fotocasa_pro"}
    assert listing.source_raw["id"] == "568615690"
