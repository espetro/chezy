"""Two-phase idealista scrape over the CDP browser.

Phase 1 walks search pages and persists the ordered id set plus a resume cursor.
Phase 2 fetches one detail page per id not yet in the master file. Both phases
share the browser's page budget, and both are resumable: an interrupted or
budget-limited run picks up where it stopped, never redoing phase 1.

The master keeps first-seen order (id order from phase 1), so tiers stay strict
prefix supersets exactly as for the HTTP platforms.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal

from chezy_scraper.adapters.idealista import GLOBALS
from chezy_scraper.fetch.browser import BrowserBlockedError, PageBudgetExceededError
from chezy_scraper.jsonx import arr, integer, obj, text
from chezy_scraper.observability import audit
from chezy_scraper.pipeline import ScrapeResult
from chezy_scraper.sinks.jsonl import (
    append_listings,
    master_path,
    raw_page_path,
    read_listings,
    write_raw_page,
)
from chezy_scraper.tiers import TIER_SIZES, Tier, write_tier

if TYPE_CHECKING:
    from datetime import datetime
    from pathlib import Path

    from chezy_scraper.adapters.idealista import IdealistaAdapter
    from chezy_scraper.config import Settings
    from chezy_scraper.fetch.browser import CdpBrowser
    from chezy_scraper.models import Operation

_PLATFORM = "idealista"


@dataclass
class IdState:
    """Phase 1 output: ids in discovery order and where to resume."""

    ids: list[str] = field(default_factory=list)
    next_page: int = 1
    total_pages: int | None = None

    @property
    def exhausted(self) -> bool:
        return self.total_pages is not None and self.next_page > self.total_pages


def state_path(settings: Settings, operation: Operation) -> Path:
    return settings.data_dir / _PLATFORM / f"{operation}-ids.json"


def load_state(path: Path) -> IdState:
    if not path.exists():
        return IdState()
    raw = obj(json.loads(path.read_text(encoding="utf-8")))
    return IdState(
        ids=[str(i) for i in arr(raw.get("ids"))],
        next_page=integer(raw.get("next_page")) or 1,
        total_pages=integer(raw.get("total_pages")),
    )


def save_state(path: Path, state: IdState) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(
            {"ids": state.ids, "next_page": state.next_page, "total_pages": state.total_pages}
        ),
        encoding="utf-8",
    )
    tmp.replace(path)


@dataclass(frozen=True)
class _Run:
    adapter: IdealistaAdapter
    browser: CdpBrowser
    settings: Settings
    operation: Operation
    run_id: str
    scraped_at: datetime

    def emit(
        self,
        action: str,
        target: str,
        outcome: Literal["success", "failure"] = "success",
        *,
        file_only: bool = False,
        **ctx: object,
    ) -> None:
        audit.child(run_id=self.run_id, platform=_PLATFORM, operation=self.operation).emit(
            action,
            actor="cli:scrape",
            outcome=outcome,
            target=target,
            file_only=file_only,
            **ctx,
        )


def scrape_idealista(  # noqa: PLR0913
    adapter: IdealistaAdapter,
    browser: CdpBrowser,
    settings: Settings,
    operation: Operation,
    tier: Tier,
    *,
    run_id: str,
    scraped_at: datetime,
) -> ScrapeResult:
    run = _Run(adapter, browser, settings, operation, run_id, scraped_at)
    master = master_path(settings, _PLATFORM, operation)
    known = {x.platform_id for x in read_listings(master)}
    target = TIER_SIZES[tier]
    path = state_path(settings, operation)
    state = load_state(path)
    new_total = 0
    try:
        _harvest(run, state, path, target)
        new_total = _fetch_details(run, state, master, known, target)
    except PageBudgetExceededError:
        run.emit("scrape.budget", f"{_PLATFORM}:{operation}", pages=browser.pages_loaded)
    except BrowserBlockedError as exc:
        run.emit("scrape.blocked", f"{_PLATFORM}:{operation}", "failure", reason=str(exc))
        raise
    tier_total = write_tier(settings, _PLATFORM, operation, tier)
    return ScrapeResult(
        platform=_PLATFORM,
        operation=operation,
        tier=tier,
        pages_fetched=browser.pages_loaded,
        new_listings=new_total,
        master_total=len(known) + new_total,
        tier_total=tier_total,
    )


def _harvest(run: _Run, state: IdState, path: Path, target: int | None) -> None:
    """Phase 1: walk list pages until the id set can fill `target` (or the results end)."""
    while not state.exhausted and (target is None or len(state.ids) < target):
        page = run.browser.load(
            run.adapter.search_url(run.operation, state.next_page), global_names=("utag_data",)
        )
        parsed = run.adapter.parse_list(page)
        if not parsed.ids:
            state.total_pages = state.next_page - 1  # ran past the last page
            save_state(path, state)
            break
        seen = set(state.ids)
        state.ids.extend(i for i in parsed.ids if i not in seen)
        state.total_pages = parsed.total_pages or state.total_pages
        run.emit(
            "scrape.page",
            f"{_PLATFORM}:{run.operation}:{state.next_page}",
            page=state.next_page,
            listings=len(parsed.ids),
            total_count=parsed.total_count,
        )
        state.next_page += 1
        save_state(path, state)


def _fetch_details(
    run: _Run, state: IdState, master: Path, known: set[str], target: int | None
) -> int:
    """Phase 2: one detail page per id still missing from the master."""
    wanted = state.ids if target is None else state.ids[:target]
    fresh = 0
    for platform_id in wanted:
        if platform_id in known:
            continue
        url = run.adapter.detail_url(platform_id)
        page = run.browser.load(url, global_names=GLOBALS)
        listing = run.adapter.parse_detail(page, operation=run.operation, scraped_at=run.scraped_at)
        write_raw_page(
            raw_page_path(run.settings, _PLATFORM, run.operation, run.run_id, len(known) + 1),
            {"url": url, **{k: v for k, v in listing.source_raw.items() if k != "url"}},
        )
        append_listings(master, [listing])
        known.add(platform_id)
        fresh += 1
        run.emit(
            "scrape.listing",
            f"{_PLATFORM}:{platform_id}",
            file_only=True,
            title=text(listing.title),
        )
    return fresh
