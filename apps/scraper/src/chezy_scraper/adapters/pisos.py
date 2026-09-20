"""pisos.com adapter.

Search pages carry no embedded search payload: each result is a
`div.ad-preview[id][data-lnk-href]` card plus a sibling
`<script type="application/ld+json">` `SingleFamilyResidence` block sharing the
card id. The card holds price, title, subtitle (neighbourhood / district /
municipality) and the characteristics strip; the ld+json block holds the first
photo and the geo coordinates. Both halves are read per card and the ld+json
block is kept as `source_raw`.

Pagination is a trailing `/<n>/` on the search path; the result count comes from
the `hdnTotalAds` / `hdnTotalAdsPerPage` hidden inputs.
"""

from __future__ import annotations

import json
import math
import re
from datetime import datetime
from typing import TYPE_CHECKING, NamedTuple, cast

from parsel import Selector
from pydantic import JsonValue

from chezy_scraper.adapters.base import SearchPage
from chezy_scraper.jsonx import JsonObj, obj, text
from chezy_scraper.models import Listing, Media, Publisher, PublisherKind

if TYPE_CHECKING:
    from chezy_scraper.models import Operation, Platform, PricePeriod

BASE = "https://www.pisos.com"
_PATH = {"rent": "alquiler", "sale": "venta"}

# "3.397 €/mes" / "450.000 €" — dot is the thousands separator, comma the decimal one.
_PRICE = re.compile(r"([\d.]+(?:,\d+)?)\s*€")
_MONTHLY = re.compile(r"/\s*mes", re.IGNORECASE)
_TEMPORARY = re.compile(r"temporada", re.IGNORECASE)
# "La Vila de Gràcia (Distrito Gràcia. Barcelona Capital)"; both halves are optional.
_SUBTITLE = re.compile(r"^(?P<area>.*?)\s*\((?P<inside>[^()]*)\)\s*$")
_DISTRICT = re.compile(r"^Distrito\s+(?P<district>.+?)\s*\.\s*(?P<municipality>.+)$")
_ROOMS = re.compile(r"^(\d+)\s*hab", re.IGNORECASE)
_BATHS = re.compile(r"^(\d+)\s*(?:baño|bano|aseo)", re.IGNORECASE)
_AREA_M2 = re.compile(r"^([\d.,]+)\s*m", re.IGNORECASE)
_RESULTS = re.compile(r"([\d.]+)\s*resultados", re.IGNORECASE)
_PUBLISHER_KINDS: dict[str, PublisherKind] = {
    "profesional": "professional",
    "particular": "private",
}


class PisosAdapter:
    platform: Platform = "pisos"

    def search_url(self, operation: Operation, page: int) -> str:
        url = f"{BASE}/{_PATH[operation]}/pisos-barcelona_capital/"
        return url if page <= 1 else f"{url}{page}/"

    def parse_list(self, html: str, *, operation: Operation, scraped_at: datetime) -> SearchPage:
        page = Selector(html)
        cards = page.css("div.ad-preview[id][data-lnk-href]")
        listings = [to_canonical(card, operation, scraped_at) for card in cards]
        total_count = _int_attr(page, "#hdnTotalAds") or _result_count(page)
        per_page = _int_attr(page, "#hdnTotalAdsPerPage") or len(listings)
        return SearchPage(
            payload=cast(
                "JsonObj",
                {
                    "total_ads": total_count,
                    "total_ads_per_page": per_page,
                    "ads": [item.source_raw for item in listings],
                },
            ),
            listings=listings,
            total_count=total_count,
            total_pages=math.ceil(total_count / per_page) if total_count and per_page else None,
        )


def _int_attr(page: Selector, css: str) -> int | None:
    raw = page.css(f"{css}::attr(value)").get()
    digits = re.sub(r"\D", "", raw) if raw is not None else ""
    return int(digits) if digits else None


def _result_count(page: Selector) -> int | None:
    """Fallback for the hidden inputs: the `"907 resultados"` headline."""
    match = _RESULTS.search(page.css(".grid__title").xpath("string()").get() or "")
    return int(match.group(1).replace(".", "")) if match else None


def _spanish_number(raw: str) -> float | None:
    """Parse `"3.397"` / `"1.234,5"` — dot groups thousands, comma is the decimal mark."""
    cleaned = raw.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _coordinate(value: object) -> float | None:
    """Geo values come as `"41,4039398"` on some cards and `"41.4039398"` on others."""
    raw = text(value)
    if raw is None:
        return None
    normalized = raw.replace(",", ".") if "," in raw else raw
    try:
        return float(normalized)
    except ValueError:
        return None


def _string(card: Selector, css: str) -> str | None:
    value = card.css(css).xpath("string()").get()
    return text(value)


def _absolute(url: str | None) -> str | None:
    if url is None:
        return None
    return f"{BASE}{url}" if url.startswith("/") else url


def _source_raw(card: Selector) -> JsonObj:
    block = card.css('script[type="application/ld+json"]::text').get()
    if block is None:
        return {}
    try:
        return obj(json.loads(block))
    except json.JSONDecodeError:
        return {}


def _price(card: Selector) -> tuple[float | None, bool]:
    raw = _string(card, ".ad-preview__price")
    return _amount(raw), bool(raw and _MONTHLY.search(raw))


def _amount(raw: str | None) -> float | None:
    if raw is None:
        return None
    match = _PRICE.search(raw)
    return _spanish_number(match.group(1)) if match else None


def _location(card: Selector) -> tuple[str | None, str | None, str | None]:
    """Split `"<neighbourhood> (Distrito <district>. <municipality>)"`."""
    subtitle = _string(card, ".ad-preview__subtitle")
    if subtitle is None:
        return None, None, None
    match = _SUBTITLE.match(subtitle)
    if match is None:
        return None, None, _municipality(subtitle)
    neighbourhood = text(match.group("area"))
    inside = match.group("inside").strip()
    district_match = _DISTRICT.match(inside)
    if district_match is None:
        return neighbourhood, None, _municipality(inside)
    return (
        neighbourhood,
        text(district_match.group("district")),
        _municipality(district_match.group("municipality")),
    )


def _municipality(raw: str) -> str | None:
    """pisos.com writes the city as `"Barcelona Capital"`; the canonical name is the city."""
    return text(re.sub(r"\s+Capital$", "", raw.strip()))


class Characteristics(NamedTuple):
    """The `"3 habs." / "2 baños" / "70 m²" / "2ª planta"` strip under the subtitle."""

    labels: list[str]
    rooms: int | None
    bathrooms: int | None
    built_m2: float | None
    floor: str | None


def _characteristics(card: Selector) -> Characteristics:
    labels = [
        label
        for raw in card.css(".ad-preview__char").xpath("string()").getall()
        if (label := text(raw)) is not None
    ]
    rooms: int | None = None
    bathrooms: int | None = None
    built_m2: float | None = None
    floor: str | None = None
    for label in labels:
        if (match := _ROOMS.match(label)) is not None:
            rooms = int(match.group(1))
        elif (match := _BATHS.match(label)) is not None:
            bathrooms = int(match.group(1))
        elif (match := _AREA_M2.match(label)) is not None:
            built_m2 = _spanish_number(match.group(1))
        elif floor is None:
            floor = label
    return Characteristics(labels, rooms, bathrooms, built_m2, floor)


def _property_type(path: str) -> str | None:
    """Detail paths are `/<operation>/<type>-<zone>-<id>/`, e.g. `/alquilar/atico-...`."""
    parts = [part for part in path.split("/") if part]
    slug = parts[1] if len(parts) > 1 else ""
    return text(slug.split("-")[0].lower())


def _publisher(card: Selector) -> Publisher | None:
    profile_url = card.css(".ad-preview__logo [data-lnk-href]::attr(data-lnk-href)").get()
    phone = card.css("[data-action='call']::attr(data-number)").get()
    tracking = (card.css("[data-ga-ecom]::attr(data-ga-ecom)").get() or "").lower()
    kind: PublisherKind | None = None
    for marker, publisher_kind in _PUBLISHER_KINDS.items():
        if marker in tracking:
            kind = publisher_kind
            break
    if not (profile_url or phone or kind):
        return None
    return Publisher(kind=kind, phone=text(phone), profile_url=_absolute(profile_url))


def _media(source_raw: JsonObj, card: Selector) -> list[Media]:
    url = text(source_raw.get("image")) or text(obj(source_raw.get("photo")).get("contentUrl"))
    if url is None:
        url = card.css(".carousel__slide img::attr(src)").get()
    absolute = _absolute(text(url))
    return [Media(url=absolute)] if absolute else []


def to_canonical(card: Selector, operation: Operation, scraped_at: datetime) -> Listing:
    source_raw = _source_raw(card)
    path = card.attrib["data-lnk-href"]
    price, monthly = _price(card)
    # "Temporada" marks a seasonal (temporary) rental; the tag only appears on those.
    type_tag = _string(card, ".ad-preview__type")
    labels, rooms, bathrooms, built_m2, floor = _characteristics(card)
    neighbourhood, district, municipality = _location(card)
    period: PricePeriod = "month" if monthly or operation == "rent" else "total"
    geo = obj(source_raw.get("geo"))
    return Listing(
        platform="pisos",
        platform_id=card.attrib["id"],
        url=_absolute(path) or BASE,
        scraped_at=scraped_at,
        operation=operation,
        price_eur=price,
        price_period=period if price is not None else None,
        price_per_m2=round(price / built_m2, 2) if price and built_m2 else None,
        price_drop_eur=_amount(_string(card, ".ad-preview__drop")),
        is_temporary_rental=True if type_tag and _TEMPORARY.search(type_tag) else None,
        property_type=_property_type(path),
        built_m2=built_m2,
        rooms=rooms,
        bathrooms=bathrooms,
        floor=floor,
        lat=_coordinate(geo.get("latitude")),
        lon=_coordinate(geo.get("longitude")),
        neighbourhood=neighbourhood,
        district=district,
        municipality=municipality
        or _municipality(text(obj(source_raw.get("address")).get("addressLocality")) or ""),
        raw_features=cast(
            "dict[str, JsonValue]",
            {"floor": floor, "characteristics": labels, "type_tag": type_tag},
        ),
        media=_media(source_raw, card),
        publisher=_publisher(card),
        title=_string(card, "a.ad-preview__title") or text(source_raw.get("name")),
        description=_string(card, ".ad-preview__description")
        or text(source_raw.get("description")),
        source_raw=cast("dict[str, JsonValue]", source_raw),
    )
