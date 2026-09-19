"""Adapter contract plus the payload extractors shared by the Adevinta sites."""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Protocol, cast

from chezy_scraper.jsonx import JsonObj, obj

if TYPE_CHECKING:
    from chezy_scraper.fetch.http import HttpFetcher
    from chezy_scraper.models import Listing, Operation, Platform

_SCRIPT_BY_ID = r'<script[^>]*\bid="{id}"[^>]*>(.*?)</script>'
_JS_JSON_PARSE = re.compile(r"window\.__INITIAL_PROPS__\s*=\s*JSON\.parse\(")


class PayloadNotFoundError(ValueError):
    """The page did not contain the expected embedded JSON payload."""


@dataclass(frozen=True)
class SearchPage:
    """One parsed search results page."""

    # The embedded payload, untouched; persisted as raw/<platform>/.../page-NNN.json.
    payload: JsonObj
    listings: list[Listing]
    total_count: int | None
    total_pages: int | None


class Adapter(Protocol):
    """A platform whose search pages carry complete listing data.

    Fotocasa and habitaclia embed everything the canonical model needs in the
    search payload, so no per-listing detail fetch exists for them. Idealista
    is different (list pages carry ids only) and lives outside this protocol.
    """

    platform: Platform

    def search_url(self, operation: Operation, page: int) -> str: ...

    def parse_list(
        self, html: str, *, operation: Operation, scraped_at: datetime
    ) -> SearchPage: ...


def extract_script_json(html: str, script_id: str) -> JsonObj:
    """Parse `<script id="...">{json}</script>`."""
    match = re.search(_SCRIPT_BY_ID.format(id=re.escape(script_id)), html, re.DOTALL)
    if match is None:
        msg = f"no <script id={script_id!r}> in page"
        raise PayloadNotFoundError(msg)
    return obj(json.loads(match.group(1)))


def extract_js_json_parse(html: str) -> JsonObj:
    """Parse `window.__INITIAL_PROPS__ = JSON.parse("<escaped json>")`.

    The argument is a JS string literal whose contents are themselves JSON, so
    it is decoded twice: literal first, then the document it contains.
    """
    match = _JS_JSON_PARSE.search(html)
    if match is None:
        msg = "no window.__INITIAL_PROPS__ = JSON.parse(...) in page"
        raise PayloadNotFoundError(msg)
    literal, _ = json.JSONDecoder().raw_decode(html, match.end())
    return obj(json.loads(cast("str", literal)))


def iter_search_pages(
    adapter: Adapter,
    fetcher: HttpFetcher,
    operation: Operation,
    *,
    scraped_at: datetime,
    start_page: int = 1,
) -> Iterator[tuple[int, SearchPage]]:
    """Yield `(page_number, page)` until the platform runs out of results."""
    page_number = start_page
    while True:
        html = fetcher.get(adapter.search_url(operation, page_number))
        page = adapter.parse_list(html, operation=operation, scraped_at=scraped_at)
        if not page.listings:
            return
        yield page_number, page
        if page.total_pages is not None and page_number >= page.total_pages:
            return
        page_number += 1
