"""Two-phase idealista pipeline with a scripted browser: budget, resume, supersets."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

import pytest
from chezy_scraper.adapters.idealista import IdealistaAdapter
from chezy_scraper.config import Settings
from chezy_scraper.fetch.browser import (
    BrowserBlockedError,
    CdpBrowser,
    PageBudgetExceededError,
    RenderedPage,
)
from chezy_scraper.jsonx import JsonObj
from chezy_scraper.pipeline_browser import load_state, scrape_idealista, state_path
from chezy_scraper.sinks.jsonl import master_path, read_listings
from chezy_scraper.tiers import Tier

FIXTURES = Path(__file__).parent / "fixtures"
DETAIL_HTML = (FIXTURES / "idealista_detail.html").read_text(encoding="utf-8")
NOW = datetime(2026, 9, 19, tzinfo=UTC)
PER_PAGE = 30
TOTAL_PAGES = 4


class FakeBrowser:
    def __init__(self, budget: int = 60, *, block_on_detail: bool = False) -> None:
        self.budget = budget
        self.block_on_detail = block_on_detail
        self.urls: list[str] = []

    @property
    def pages_loaded(self) -> int:
        return len(self.urls)

    @property
    def pages_left(self) -> int:
        return self.budget - len(self.urls)

    def load(self, url: str, *, global_names: tuple[str, ...] = ()) -> RenderedPage:  # noqa: ARG002
        if self.pages_left <= 0:
            raise PageBudgetExceededError
        self.urls.append(url)
        if "/inmueble/" in url:
            if self.block_on_detail:
                raise BrowserBlockedError
            return RenderedPage(url=url, html=DETAIL_HTML, globals={"utag_data": {}})
        number = (
            int(url.rsplit("pagina-", 1)[1].split(".", maxsplit=1)[0]) if "pagina-" in url else 1
        )
        first = (number - 1) * PER_PAGE
        ids = ",".join(str(1000 + first + i) for i in range(PER_PAGE))
        utag: JsonObj = {
            "list_ads_adId": ids,
            "list_totalResult": str(PER_PAGE * TOTAL_PAGES),
            "list_totalPageNumber": TOTAL_PAGES,
        }
        return RenderedPage(url=url, html="<html></html>", globals={"utag_data": utag})


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return replace(Settings.from_env(), data_dir=tmp_path)


def _run(settings: Settings, browser: FakeBrowser, tier: str = "small") -> int:
    result = scrape_idealista(
        IdealistaAdapter(),
        cast("CdpBrowser", browser),
        settings,
        "rent",
        cast("Tier", tier),
        run_id="r1",
        scraped_at=NOW,
    )
    return result.tier_total


def test_small_tier_walks_two_list_pages_then_fifty_details(settings: Settings) -> None:
    browser = FakeBrowser()
    assert _run(settings, browser) == 50
    lists = [u for u in browser.urls if "/inmueble/" not in u]
    assert len(lists) == 2
    assert browser.pages_loaded == 2 + 50
    ids = [x.platform_id for x in read_listings(master_path(settings, "idealista", "rent"))]
    assert ids == [str(1000 + i) for i in range(50)]
    assert load_state(state_path(settings, "rent")).next_page == 3


def test_rerun_is_free_and_medium_extends_small(settings: Settings) -> None:
    _run(settings, FakeBrowser())
    again = FakeBrowser()
    assert _run(settings, again) == 50
    assert again.pages_loaded == 0
    medium = FakeBrowser(budget=500)
    assert _run(settings, medium, "medium") == PER_PAGE * TOTAL_PAGES  # only 120 exist
    lists = [u for u in medium.urls if "/inmueble/" not in u]
    assert [u.rsplit("/", 1)[1] for u in lists] == ["pagina-3.htm", "pagina-4.htm"]
    ids = [x.platform_id for x in read_listings(master_path(settings, "idealista", "rent"))]
    assert ids[:50] == [str(1000 + i) for i in range(50)]


def test_budget_stops_cleanly_and_next_run_resumes(settings: Settings) -> None:
    first = FakeBrowser(budget=10)
    assert _run(settings, first) == 8  # 2 list pages + 8 details
    second = FakeBrowser(budget=60)
    assert _run(settings, second) == 50
    assert not any("pagina-" in u or u.endswith("barcelona-barcelona/") for u in second.urls)
    assert second.pages_loaded == 42


def test_block_is_reraised(settings: Settings) -> None:
    with pytest.raises(BrowserBlockedError):
        _run(settings, FakeBrowser(block_on_detail=True))
