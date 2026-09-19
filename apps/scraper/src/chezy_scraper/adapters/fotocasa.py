"""fotocasa.es adapter.

Search pages embed `<script id="__initial_props__">` with 31 complete listings
under `initialSearch.result.realEstates`. Pagination is `.../l/<n>`.

Fotocasa gives no street address, no energy certificate and encodes several
attributes (floor, antiquity, orientation, conservation) as undocumented
integer codes. Those codes are preserved in `raw_features` and deliberately
not mapped to labels we would have to guess.
"""

from __future__ import annotations

import math
import re
from datetime import UTC, datetime
from typing import TYPE_CHECKING, cast

from pydantic import JsonValue

from chezy_scraper.adapters.base import SearchPage, extract_script_json
from chezy_scraper.jsonx import JsonObj, arr, boolean, dig, integer, number, obj, text
from chezy_scraper.models import Listing, Media, Publisher
from chezy_scraper.vocab import FOTOCASA_DYNAMIC, FOTOCASA_FEATURES, normalize

if TYPE_CHECKING:
    from chezy_scraper.models import LocationAccuracy, MediaKind, Operation, Platform

BASE = "https://www.fotocasa.es"
_PATH = {"rent": "alquiler", "sale": "comprar"}
_VIDEO_TYPES = {"youtube", "vimeo", "video"}
_PRICE_DIGITS = re.compile(r"\D")
_SUBTYPES = {"attic": "penthouse", "house_chalet": "house"}


class FotocasaAdapter:
    platform: Platform = "fotocasa"

    def search_url(self, operation: Operation, page: int) -> str:
        url = f"{BASE}/es/{_PATH[operation]}/viviendas/barcelona-capital/todas-las-zonas/l"
        return url if page <= 1 else f"{url}/{page}"

    def parse_list(self, html: str, *, operation: Operation, scraped_at: datetime) -> SearchPage:
        payload = extract_script_json(html, "__initial_props__")
        result = obj(dig(payload, "initialSearch", "result"))
        items = [obj(item) for item in arr(result.get("realEstates"))]
        total = integer(result.get("count"))
        total_pages = math.ceil(total / len(items)) if total and items else None
        return SearchPage(
            payload=payload,
            listings=[to_canonical(item, operation, scraped_at) for item in items],
            total_count=total,
            total_pages=total_pages,
        )


def _price_amount(value: object) -> float | None:
    """Parse display prices like `"1.000 €"` (dot is the thousands separator)."""
    raw = text(value)
    if raw is None:
        return None
    digits = _PRICE_DIGITS.sub("", raw)
    return float(digits) if digits else None


def _timestamp(value: object) -> datetime | None:
    millis = number(value)
    return datetime.fromtimestamp(millis / 1000, tz=UTC) if millis is not None else None


def _media(items: list[object]) -> list[Media]:
    media: list[Media] = []
    for raw in items:
        item = obj(raw)
        src = text(item.get("src"))
        if src is None:
            continue
        kind: MediaKind = "video" if text(item.get("type")) in _VIDEO_TYPES else "photo"
        room = text(item.get("roomType"))
        media.append(Media(url=src, kind=kind, room_type=room))
    return media


def to_canonical(item: JsonObj, operation: Operation, scraped_at: datetime) -> Listing:
    features = {
        key: value
        for feature in arr(item.get("features"))
        if (key := text(obj(feature).get("key"))) is not None
        and (value := integer(obj(feature).get("value"))) is not None
    }
    dynamic = [d for raw in arr(item.get("dynamicFeatures")) if (d := text(raw)) is not None]
    amenity_keys = [*features, *dynamic]
    mapping = {**FOTOCASA_FEATURES, **FOTOCASA_DYNAMIC}

    price = number(item.get("rawPrice"))
    built = number(features.get("surface"))
    coordinates = obj(item.get("coordinates"))
    address = obj(item.get("address"))
    accuracy: LocationAccuracy | None = None
    if coordinates:
        # Heuristic: fotocasa flags a small minority of listings with
        # coordinates.accuracy == 1; everything else is blurred to the zone.
        accuracy = "exact" if integer(coordinates.get("accuracy")) == 1 else "zone"

    detail = text(dig(item, "detail", "es-ES")) or ""
    client_type = text(item.get("clientType"))
    client_url = text(item.get("clientUrl"))
    subtype = (text(item.get("buildingSubtype")) or "").lower() or None

    furnished: bool | None = None
    if "furnished" in features:
        furnished = True
    elif "not_furnished" in features:
        furnished = False

    return Listing(
        platform="fotocasa",
        platform_id=str(item.get("id")),
        url=f"{BASE}{detail.split('?')[0]}" if detail else BASE,
        scraped_at=scraped_at,
        published_at=_timestamp(dig(item, "dateOriginal", "timestamp")),
        updated_at=_timestamp(dig(item, "date", "timestamp")),
        operation=operation,
        price_eur=price,
        price_period="month" if operation == "rent" else "total",
        price_per_m2=round(price / built, 2) if price and built else None,
        price_drop_eur=_price_amount(item.get("reducedPrice")),
        is_temporary_rental=boolean(item.get("isTemporaryRental")),
        property_type=(text(item.get("buildingType")) or "").lower() or None,
        property_subtype=_SUBTYPES.get(subtype or "", subtype),
        built_m2=built,
        rooms=features.get("rooms"),
        bathrooms=features.get("bathrooms"),
        furnished=furnished,
        lat=number(coordinates.get("latitude")),
        lon=number(coordinates.get("longitude")),
        neighbourhood=text(address.get("neighborhood")),
        district=text(address.get("district")),
        municipality=text(address.get("municipality")),
        postal_code=text(address.get("zipCode")),
        location_accuracy=accuracy,
        amenities=normalize(amenity_keys, mapping),
        raw_features={
            "features": cast("JsonValue", features),
            "dynamic_features": cast("JsonValue", dynamic),
        },
        media=_media(arr(item.get("multimedia"))),
        publisher=Publisher(
            name=text(item.get("clientAlias")),
            kind="professional"
            if client_type == "professional"
            else "private"
            if client_type
            else None,
            phone=text(item.get("phone")),
            profile_url=f"{BASE}{client_url}" if client_url else None,
        ),
        description=text(item.get("description")),
        source_raw=cast("dict[str, JsonValue]", item),
    )
