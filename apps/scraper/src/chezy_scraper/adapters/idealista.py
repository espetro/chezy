"""idealista.com adapter (browser only; see `fetch/browser.py`).

List pages carry ids, not data:

- `article.item[data-element-id]` per result, plus `window.utag_data` with
  `list_ads_adId` (CSV of every id on the page), `list_totalResult` and
  `list_totalPageNumber`.

Detail pages combine `window.adMultimediasInfo` (gallery, plans, videos, tours),
`window.utag_data`, and DOM sections (`Características básicas`, `Edificio`,
`Equipamiento`, `Certificado energético`).

Markup here follows what the pages looked like when scouted; idealista changes it
without notice, so every extractor degrades to `None` instead of raising and the raw
payload is always preserved in `source_raw`.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import TYPE_CHECKING, Final, Literal, cast

from parsel import Selector

from chezy_scraper.jsonx import JsonObj, arr, integer, obj, text
from chezy_scraper.models import Listing, Media, Publisher
from chezy_scraper.vocab import IDEALISTA_KEYWORDS, keyword_amenities

if TYPE_CHECKING:
    from datetime import datetime

    from chezy_scraper.fetch.browser import RenderedPage
    from chezy_scraper.models import Operation, Platform

BASE = "https://www.idealista.com"
GLOBALS = ("utag_data", "adMultimediasInfo")
DEFAULT_SEARCH_URLS: dict[str, str] = {
    "rent": f"{BASE}/alquiler-viviendas/barcelona-barcelona/",
    "sale": f"{BASE}/venta-viviendas/barcelona-barcelona/",
}

_ID_IN_URL = re.compile(r"/inmueble/(\d+)")
_NUMBER = re.compile(r"\d[\d.,]*")
_LAT = re.compile(r"latitude\W{1,4}(-?\d{1,3}\.\d+)")
_LON = re.compile(r"longitude\W{1,4}(-?\d{1,3}\.\d+)")
# Items of the list after a heading: the list is either a sibling or wrapped in a div.
_SECTION_ITEMS = "following-sibling::*[1][self::ul]/li | following-sibling::*[1][self::div]//li"
_ENERGY_CLASS = re.compile(r"icon-energy-(c|e)-([a-g])", re.IGNORECASE)
_STREET_NUMBER = re.compile(r",\s*(\d+\w?)\s*$")
_CONDITIONS = {
    "obra nueva": "new_build",
    "buen estado": "good",
    "para reformar": "to_renovate",
}


@dataclass(frozen=True)
class IdealistaListPage:
    ids: list[str]
    total_count: int | None
    total_pages: int | None


def _clean(value: str | None) -> str:
    return " ".join((value or "").split())


def _num(value: str | None) -> float | None:
    """`1.200` and `1.200,50` (es-ES) to floats."""
    if not value:
        return None
    match = _NUMBER.search(value)
    if match is None:
        return None
    raw = match.group(0)
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(\.\d{3})+", raw):
        raw = raw.replace(".", "")
    try:
        return float(raw)
    except ValueError:
        return None


def _to_int(value: float | None) -> int | None:
    return None if value is None else int(value)


def _as_int(value: object) -> int | None:
    if (whole := integer(value)) is not None:
        return whole
    return _to_int(_num(text(value)))


class IdealistaAdapter:
    platform: Platform = "idealista"

    def __init__(self, search_urls: dict[str, str] | None = None) -> None:
        self._urls = {**DEFAULT_SEARCH_URLS, **(search_urls or {})}

    def search_url(self, operation: Operation, page: int) -> str:
        """`.../` for page 1, `.../pagina-N.htm` after; a `?shape=` query is preserved."""
        base, _, query = self._urls[operation].partition("?")
        base = base if base.endswith("/") else base + "/"
        url = base if page <= 1 else f"{base}pagina-{page}.htm"
        return f"{url}?{query}" if query else url

    @staticmethod
    def detail_url(platform_id: str) -> str:
        return f"{BASE}/inmueble/{platform_id}/"

    # -- list ---------------------------------------------------------------

    def parse_list(self, page: RenderedPage) -> IdealistaListPage:
        utag = obj(page.globals.get("utag_data"))
        ids: dict[str, None] = {}
        for raw in str(utag.get("list_ads_adId") or "").split(","):
            if raw.strip().isdigit():
                ids.setdefault(raw.strip())
        dom_ids = Selector(page.html).css("article.item[data-element-id]::attr(data-element-id)")
        for attr in dom_ids.getall():
            if attr.strip().isdigit():
                ids.setdefault(attr.strip())
        return IdealistaListPage(
            ids=list(ids),
            total_count=_as_int(utag.get("list_totalResult")),
            total_pages=_as_int(utag.get("list_totalPageNumber")),
        )

    # -- detail -------------------------------------------------------------

    def parse_detail(
        self, page: RenderedPage, *, operation: Operation, scraped_at: datetime
    ) -> Listing:
        match = _ID_IN_URL.search(page.url)
        if match is None:
            msg = f"not an idealista detail url: {page.url}"
            raise ValueError(msg)
        sel = Selector(page.html)
        sections = _sections(sel)
        lines = [line for items in sections.values() for line in items]
        top = [_clean(t) for t in sel.css(".info-features span::text").getall() if _clean(t)]
        facts = _Facts()
        for line in [*top, *lines]:
            facts.absorb(line)
        facts.built_m2 = facts.built_m2 or next(
            (v for line in top if (v := _num(_group(_BARE_M2, line)))), None
        )
        tags = [_clean(t).lower() for t in sel.css(".detail-info-tags .tag::text").getall()]
        multimedia = obj(page.globals.get("adMultimediasInfo"))
        price_text = _clean(" ".join(sel.css(".info-data-price ::text").getall()))
        payload: JsonObj = {
            "url": page.url,
            "utag_data": page.globals.get("utag_data"),
            "ad_multimedias_info": multimedia,
            "sections": cast("JsonObj", sections),
        }
        fields: dict[str, object] = {
            "platform": "idealista",
            "platform_id": match.group(1),
            "url": page.url,
            "scraped_at": scraped_at,
            "operation": operation,
            "price_eur": _num(price_text),
            "price_period": "month" if "/mes" in price_text else "total",
            "title": _clean(sel.css("h1 .main-info__title-main::text").get()) or None,
            "description": _description(sel),
            "property_type": _property_type(sel),
            **asdict(facts),
            "is_temporary_rental": True if any("temporada" in t for t in tags) else None,
            **_energy(sel),
            **_location(sel, page.html),
            "amenities": keyword_amenities([*top, *lines], IDEALISTA_KEYWORDS),
            "raw_features": {"sections": sections},
            "media": [m.model_dump() for m in _media(multimedia)],
            "publisher": (p.model_dump() if (p := _publisher(sel)) else None),
            "source_raw": payload,
        }
        return Listing.model_validate(fields)


# -- DOM helpers ---------------------------------------------------------------


def _sections(sel: Selector) -> dict[str, list[str]]:
    """Heading text to the `li` lines of the list that follows it."""
    out: dict[str, list[str]] = {}
    for heading in sel.css(".details-property h2"):
        name = _clean(heading.css("::text").get())
        items = [
            _clean(" ".join(li.css("::text").getall())) for li in heading.xpath(_SECTION_ITEMS)
        ]
        if name:
            out[name] = [item for item in items if item]
    return out


def _description(sel: Selector) -> str | None:
    paragraphs = sel.css(".comment .adCommentsLanguage p::text, .comment p::text").getall()
    joined = "\n".join(_clean(p) for p in paragraphs if _clean(p))
    return joined or None


def _property_type(sel: Selector) -> str | None:
    title = _clean(sel.css("h1 .main-info__title-main::text").get()).lower()
    first = title.split(" en ", maxsplit=1)[0].strip()
    return first or None


def _energy(sel: Selector) -> dict[str, object]:
    out: dict[str, object] = {}
    for li in sel.css(".details-property li"):
        line = _clean(" ".join(li.css("::text").getall()))
        klass = " ".join(li.css("*::attr(class)").getall())
        match = _ENERGY_CLASS.search(klass)
        lowered = line.lower()
        if "consumo" in lowered or (match and match.group(1).lower() == "c"):
            out["energy_consumption_label"] = match.group(2).upper() if match else None
            out["energy_consumption_value"] = _num(line)
        elif "emisiones" in lowered or (match and match.group(1).lower() == "e"):
            out["energy_emissions_label"] = match.group(2).upper() if match else None
            out["energy_emissions_value"] = _num(line)
    return out


def _location(sel: Selector, html: str) -> dict[str, object]:
    out: dict[str, object] = {"location_accuracy": "zone"}
    entries = [_clean(t) for t in sel.css("#headerMap li::text").getall() if _clean(t)]
    street_set = False
    for entry in entries:
        lowered = entry.lower()
        if lowered.startswith("barrio"):
            out["neighbourhood"] = _clean(entry.split(" ", maxsplit=1)[1])
        elif lowered.startswith("distrito"):
            out["district"] = _clean(entry.split(" ", maxsplit=1)[1])
        elif not street_set and not lowered.startswith(("barcelona", "provincia")):
            out["street"] = _STREET_NUMBER.sub("", entry)
            number = _STREET_NUMBER.search(entry)
            out["street_number"] = number.group(1) if number else None
            out["location_accuracy"] = "street"
            street_set = True
    if entries:
        out["municipality"] = entries[-1].split(",")[0].strip() or None
    lat, lon = _LAT.search(html), _LON.search(html)
    if lat and lon:
        out["lat"], out["lon"] = float(lat.group(1)), float(lon.group(1))
    return out


_KIND_LABELS: Final[dict[str, Literal["professional", "private"]]] = {
    "profesional": "professional",
    "particular": "private",
}


def _publisher(sel: Selector) -> Publisher | None:
    """Live pages show only the advertiser type ("Profesional"/"Particular") in these nodes."""
    name = _clean(sel.css(".about-advertiser-name::text, .professional-name .name::text").get())
    if not name:
        return None
    label = _KIND_LABELS.get(name.lower())
    if label is not None:
        return Publisher(name=None, kind=label)
    return Publisher(
        name=name,
        kind="professional" if sel.css(".professional-name") else "private",
    )


def _media(multimedia: JsonObj) -> list[Media]:
    media: list[Media] = []
    for raw in arr(multimedia.get("fullScreenGalleryPics")):
        pic = obj(raw)
        src = text(pic.get("src"))
        if src:
            room = text(pic.get("tag")) or text(pic.get("hoverText"))
            media.append(Media(url=src, room_type=room.lower() if room else None))
    for raw in arr(multimedia.get("plans")):
        src = text(obj(raw).get("src")) or text(obj(raw).get("url")) or text(raw)
        if src:
            media.append(Media(url=src, kind="plan"))
    for raw in arr(multimedia.get("videos")):
        src = text(obj(raw).get("src")) or text(obj(raw).get("url")) or text(raw)
        if src:
            media.append(Media(url=src, kind="video"))
    for key in ("visit3DTourURL", "virtualTour360URL"):
        src = text(multimedia.get(key))
        if src:
            media.append(Media(url=src, kind="tour_3d"))
    return media


# -- line facts ------------------------------------------------------------------

_BUILT = re.compile(r"(\d[\d.,]*)\s*m²\s*construidos", re.IGNORECASE)
_BARE_M2 = re.compile(r"^(\d[\d.,]*)\s*m²$")
_USABLE = re.compile(r"(\d[\d.,]*)\s*m²\s*útiles", re.IGNORECASE)
_ROOMS = re.compile(r"(\d+)\s*(?:habitaci|hab\.)", re.IGNORECASE)
_BATHS = re.compile(r"(\d+)\s*baños?", re.IGNORECASE)
_YEAR = re.compile(r"construido en\s*(\d{4})", re.IGNORECASE)
_FLOOR = re.compile(r"^planta\s*(\d+)", re.IGNORECASE)
_ORIENTATION = re.compile(r"orientaci[óo]n\s+(.+)$", re.IGNORECASE)
_HEATING = re.compile(r"(calefacci[óo]n\s+\w+(?:\s+\w+)?)", re.IGNORECASE)


def _group(pattern: re.Pattern[str], line: str) -> str | None:
    match = pattern.search(line)
    return match.group(1).strip() if match else None


@dataclass
class _Facts:
    """Facts scraped from free-text lines; later lines never erase earlier hits."""

    built_m2: float | None = None
    usable_m2: float | None = None
    rooms: int | None = None
    bathrooms: int | None = None
    floor: str | None = None
    orientation: str | None = None
    year_built: int | None = None
    condition: str | None = None
    heating: str | None = None
    furnished: bool | None = None

    def absorb(self, line: str) -> None:
        lowered = line.lower()
        self.built_m2 = _num(_group(_BUILT, line)) or self.built_m2
        self.usable_m2 = _num(_group(_USABLE, line)) or self.usable_m2
        self.rooms = _as_int(_group(_ROOMS, line)) or self.rooms
        self.bathrooms = _as_int(_group(_BATHS, line)) or self.bathrooms
        self.year_built = _as_int(_group(_YEAR, line)) or self.year_built
        self.floor = _group(_FLOOR, line) or ("0" if lowered.startswith("bajo") else self.floor)
        self.orientation = _group(_ORIENTATION, line) or self.orientation
        self.heating = _group(_HEATING, line) or self.heating
        for phrase, label in _CONDITIONS.items():
            if phrase in lowered:
                self.condition = label
        if "amueblado" in lowered:
            self.furnished = not lowered.startswith("sin ")
