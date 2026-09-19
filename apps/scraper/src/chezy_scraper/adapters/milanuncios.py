"""milanuncios.com adapter (tier 2).

Search pages carry `window.__INITIAL_PROPS__ = JSON.parse("...")` (same shape as
habitaclia) with 41 complete ads under `adListPagination.adList.ads`. Pagination is
`?pagina=N`.

The feed is thin on structure: rooms, bathrooms and built m2 arrive as `tags`; there is
no coordinates, street or energy data. `origin.provider` shows most professional ads are
cross-posts from other portals (e.g. `fotocasa_pro`), so expect heavy overlap with
those platforms; it is kept in `raw_features` for dedupe.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import TYPE_CHECKING, cast

from pydantic import JsonValue

from chezy_scraper.adapters.base import SearchPage, extract_js_json_parse
from chezy_scraper.jsonx import JsonObj, arr, dig, integer, number, obj, text
from chezy_scraper.models import Listing, Media, Publisher, PublisherKind

if TYPE_CHECKING:
    from chezy_scraper.models import Operation, Platform

BASE = "https://www.milanuncios.com"
_PATH = {"rent": "alquiler-de-pisos", "sale": "venta-de-pisos"}
_NUMBER = re.compile(r"\d[\d.,]*")
_PUBLISHER_KINDS: dict[str, PublisherKind] = {"professional": "professional", "private": "private"}


class MilanunciosAdapter:
    platform: Platform = "milanuncios"

    def search_url(self, operation: Operation, page: int) -> str:
        url = f"{BASE}/{_PATH[operation]}-en-barcelona-barcelona/"
        return url if page <= 1 else f"{url}?pagina={page}"

    def parse_list(self, html: str, *, operation: Operation, scraped_at: datetime) -> SearchPage:
        payload = extract_js_json_parse(html)
        block = obj(dig(payload, "adListPagination"))
        ads = [obj(ad) for ad in arr(dig(block, "adList", "ads"))]
        pagination = obj(block.get("pagination"))
        return SearchPage(
            payload=cast("JsonObj", {"adListPagination": block}),
            listings=[to_canonical(ad, operation, scraped_at) for ad in ads],
            total_count=integer(pagination.get("totalAds")),
            total_pages=integer(pagination.get("totalPages")),
        )


def _timestamp(value: object) -> datetime | None:
    raw = text(value)
    return datetime.fromisoformat(raw) if raw else None


def _tag_number(tags: dict[str, str], key: str) -> float | None:
    match = _NUMBER.search(tags.get(key, ""))
    return float(match.group(0).replace(".", "").replace(",", ".")) if match else None


def _media(ad: JsonObj) -> list[Media]:
    # Image hosts come without a scheme.
    return [Media(url=f"https://{path}") for raw in arr(ad.get("images")) if (path := text(raw))]


def _publisher(ad: JsonObj) -> Publisher | None:
    name = text(ad.get("seoTitle"))
    kind = _PUBLISHER_KINDS.get(text(ad.get("sellerType")) or "")
    return Publisher(name=name, kind=kind) if name or kind else None


def to_canonical(ad: JsonObj, operation: Operation, scraped_at: datetime) -> Listing:
    tags = {
        text(obj(t).get("type")) or "": text(obj(t).get("text")) or "" for t in arr(ad.get("tags"))
    }
    price = number(dig(ad, "price", "cashPrice", "value"))
    rooms = _tag_number(tags, "dormitorios")
    baths = _tag_number(tags, "baños")
    url = text(ad.get("url")) or ""
    return Listing(
        platform="milanuncios",
        platform_id=str(ad["id"]),
        url=f"{BASE}{url}" if url.startswith("/") else url,
        scraped_at=scraped_at,
        published_at=_timestamp(ad.get("publishDate")),
        updated_at=_timestamp(ad.get("updateDate")),
        operation=operation,
        price_eur=price,
        price_period="month" if operation == "rent" else "total",
        property_type=(text(dig(ad, "categoryTree", 2, "name")) or "").lower() or None,
        built_m2=_tag_number(tags, "metros cuadrados"),
        rooms=int(rooms) if rooms is not None else None,
        bathrooms=int(baths) if baths is not None else None,
        municipality=text(dig(ad, "city", "name")),
        title=text(ad.get("title")),
        description=text(ad.get("description")),
        raw_features=cast(
            "dict[str, JsonValue]",
            {
                "origin": ad.get("origin"),
                "sell_type": ad.get("sellType"),
                "is_vip": ad.get("isVipContent"),
                "tags": tags,
            },
        ),
        media=_media(ad),
        publisher=_publisher(ad),
        source_raw=cast("dict[str, JsonValue]", ad),
    )
