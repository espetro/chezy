"""habitaclia.com adapter.

Search pages carry `window.__INITIAL_PROPS__ = JSON.parse("...")` with 30
complete listings under `initialSearchResultsPage.initialSearchContext.results`.
Pagination is `.../s/<n>` (a `?page=n` query silently returns page 1).

Unlike fotocasa it provides street name + number, energy certificate values
(when the certificate is not `PENDING`) and the price-drop delta.
"""

from __future__ import annotations

import math
import re
from datetime import datetime
from typing import TYPE_CHECKING, cast

from pydantic import JsonValue

from chezy_scraper.adapters.base import SearchPage, extract_js_json_parse
from chezy_scraper.jsonx import JsonObj, arr, dig, integer, number, obj, text
from chezy_scraper.models import Listing, Media, Publisher
from chezy_scraper.vocab import HABITACLIA_DYNAMIC, HABITACLIA_FEATURES, normalize

if TYPE_CHECKING:
    from chezy_scraper.models import LocationAccuracy, Operation, Platform

BASE = "https://www.habitaclia.com"
_PATH = {"rent": "alquiler", "sale": "comprar"}
_ORDINALS = {
    "FIRST": "1",
    "SECOND": "2",
    "THIRD": "3",
    "FOURTH": "4",
    "FIFTH": "5",
    "SIXTH": "6",
    "SEVENTH": "7",
    "EIGHTH": "8",
    "NINTH": "9",
    "TENTH": "10",
}
_EXTRA_FRACTION = re.compile(r"(\.\d{6})\d+")
_ACCURACY: dict[str, LocationAccuracy] = {"EXACT": "exact", "STREET": "street", "ZONE": "zone"}


class HabitacliaAdapter:
    platform: Platform = "habitaclia"

    def search_url(self, operation: Operation, page: int) -> str:
        url = f"{BASE}/{_PATH[operation]}/viviendas/barcelona-provincia/barcelona-capital/s"
        return url if page <= 1 else f"{url}/{page}"

    def parse_list(self, html: str, *, operation: Operation, scraped_at: datetime) -> SearchPage:
        payload = extract_js_json_parse(html)
        results = obj(dig(payload, "initialSearchResultsPage", "initialSearchContext", "results"))
        items = [obj(item) for item in arr(results.get("items"))]
        pagination = obj(results.get("pagination"))
        total = integer(pagination.get("totalCount"))
        total_pages = integer(pagination.get("totalPages"))
        if total_pages is None and total and items:
            total_pages = math.ceil(total / len(items))
        return SearchPage(
            payload=payload,
            listings=[to_canonical(item, operation, scraped_at) for item in items],
            total_count=total,
            total_pages=total_pages,
        )


def _labelled(value: object) -> str | None:
    """`NORTH_EAST` -> `north_east`; `NON_SPECIFIED` -> None."""
    raw = text(value)
    if raw is None or raw == "NON_SPECIFIED":
        return None
    return raw.lower()


def _strings(value: object) -> list[str]:
    return [s for raw in arr(value) if (s := text(raw)) is not None]


def _layer(layers: list[object], kind: str) -> str | None:
    for raw in layers:
        layer = obj(raw)
        if layer.get("type") == kind:
            return text(layer.get("value"))
    return None


def _media(multimedia: JsonObj) -> list[Media]:
    media: list[Media] = []
    for raw in arr(multimedia.get("images")):
        if (url := text(obj(raw).get("url"))) is not None:
            media.append(Media(url=url, kind="photo", room_type=text(obj(raw).get("type"))))
    for raw in arr(multimedia.get("videos")):
        if (url := text(obj(raw).get("url"))) is not None:
            media.append(Media(url=url, kind="video"))
    for raw in arr(multimedia.get("virtualTours")):
        if (url := text(obj(raw).get("url"))) is not None:
            media.append(Media(url=url, kind="tour_3d"))
    return media


def to_canonical(item: JsonObj, operation: Operation, scraped_at: datetime) -> Listing:
    summary = obj(item.get("summary"))
    prop = obj(item.get("property"))
    price_info = obj(dig(item, "transaction", "price"))
    location = obj(summary.get("location"))
    address = obj(location.get("address"))
    coords = obj(location.get("coordinates"))
    layers = arr(location.get("layers"))
    has = _strings(dig(prop, "features", "has"))
    has_not = _strings(dig(prop, "features", "hasNot"))
    dynamic = _strings(prop.get("dynamicFeatures"))
    certificate = obj(dig(prop, "energyEfficiencyCertificate", "data"))
    publisher = obj(summary.get("publisher"))
    contact = obj(item.get("contact"))

    price = number(price_info.get("amount"))
    built = number(prop.get("builtSurface"))
    nav = text(item.get("navigationUrl")) or ""
    floor = text(prop.get("floor"))
    street = text(address.get("streetName"))

    furnished: bool | None = None
    if "FURNISHED" in has:
        furnished = True
    elif "FURNISHED" in has_not:
        furnished = False

    return Listing(
        platform="habitaclia",
        platform_id=str(item.get("legacyNumericId") or item.get("id")),
        url=f"{BASE}{nav.split('?')[0]}" if nav else BASE,
        scraped_at=scraped_at,
        updated_at=_parse_iso(summary.get("updatedAt")),
        operation=operation,
        price_eur=price,
        price_period="month" if operation == "rent" else "total",
        price_per_m2=number(dig(item, "transaction", "pricePerSquareMeter"))
        or (round(price / built, 2) if price and built else None),
        price_drop_eur=number(dig(price_info, "priceDrop", "reductionAmount")),
        is_temporary_rental="IS_TEMPORARY" in dynamic or None,
        property_type=_labelled(prop.get("propertyType")),
        property_subtype=_labelled(prop.get("propertySubtype")),
        built_m2=built,
        usable_m2=number(prop.get("landArea")),
        rooms=integer(prop.get("rooms")),
        bathrooms=integer(prop.get("bathrooms")),
        floor=_ORDINALS.get(floor or "", (floor or "").lower() or None),
        orientation=_labelled(prop.get("orientation")),
        condition=_labelled(prop.get("status")),
        furnished=furnished,
        heating=_labelled(prop.get("heating")),
        energy_consumption_label=text(dig(certificate, "consumption", "label")),
        energy_consumption_value=number(dig(certificate, "consumption", "value")),
        energy_emissions_label=text(dig(certificate, "emissions", "label")),
        energy_emissions_value=number(dig(certificate, "emissions", "value")),
        lat=number(coords.get("latitude")),
        lon=number(coords.get("longitude")),
        street=street,
        street_number=text(address.get("streetNumber")),
        neighbourhood=_layer(layers, "neighbourhood"),
        district=text(location.get("district")),
        municipality=text(location.get("municipality")),
        location_accuracy=_ACCURACY.get(text(location.get("visibility")) or ""),
        amenities=normalize([*has, *dynamic], {**HABITACLIA_FEATURES, **HABITACLIA_DYNAMIC}),
        raw_features={
            "has": cast("JsonValue", has),
            "has_not": cast("JsonValue", has_not),
            "dynamic_features": cast("JsonValue", dynamic),
            "hot_water": cast("JsonValue", _labelled(prop.get("hotWater"))),
        },
        media=_media(obj(summary.get("multimedia"))),
        publisher=Publisher(
            name=text(publisher.get("tradeName")) or text(publisher.get("name")),
            kind="professional" if publisher.get("isAgent") is True else None,
            phone=text(contact.get("phone")),
            email=text(contact.get("email")),
            profile_url=(
                f"{BASE}{nav_url}" if (nav_url := text(publisher.get("navigationUrl"))) else None
            ),
        ),
        title=text(summary.get("title")),
        description=text(summary.get("description")),
        source_raw=cast("dict[str, JsonValue]", item),
    )


def _parse_iso(value: object) -> datetime | None:
    raw = text(value)
    if raw is None:
        return None
    # habitaclia emits 7 fractional digits; fromisoformat accepts at most 6.
    return datetime.fromisoformat(_EXTRA_FRACTION.sub(r"\1", raw))
