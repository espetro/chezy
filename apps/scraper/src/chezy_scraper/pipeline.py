"""Scrape orchestration for platforms served over plain HTTP."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from chezy_scraper.adapters.base import iter_search_pages
from chezy_scraper.fetch.http import BlockedError
from chezy_scraper.observability import audit
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

    from chezy_scraper.adapters.base import Adapter
    from chezy_scraper.config import Settings
    from chezy_scraper.fetch.http import HttpFetcher
    from chezy_scraper.models import Operation


@dataclass(frozen=True)
class ScrapeResult:
    platform: str
    operation: str
    tier: Tier
    pages_fetched: int
    new_listings: int
    master_total: int
    tier_total: int


def scrape(  # noqa: PLR0913
    adapter: Adapter,
    fetcher: HttpFetcher,
    settings: Settings,
    operation: Operation,
    tier: Tier,
    *,
    run_id: str,
    scraped_at: datetime,
) -> ScrapeResult:
    """Grow the master file until it can fill `tier`, then rewrite the tier slice."""
    platform = adapter.platform
    master = master_path(settings, platform, operation)
    known = {listing.platform_id for listing in read_listings(master)}
    target = TIER_SIZES[tier]
    log = audit.child(run_id=run_id, platform=platform, operation=operation, tier=tier)

    pages = 0
    new_total = 0
    if target is None or len(known) < target:
        try:
            for number, page in iter_search_pages(
                adapter, fetcher, operation, scraped_at=scraped_at
            ):
                pages += 1
                write_raw_page(
                    raw_page_path(settings, platform, operation, run_id, number), page.payload
                )
                fresh = [x for x in page.listings if x.platform_id not in known]
                append_listings(master, fresh)
                known.update(x.platform_id for x in fresh)
                new_total += len(fresh)
                log.emit(
                    "scrape.page",
                    actor="cli:scrape",
                    outcome="success",
                    target=f"{platform}:{operation}:{number}",
                    page=number,
                    listings=len(page.listings),
                    new=len(fresh),
                    total_count=page.total_count,
                )
                for listing in fresh:
                    log.emit(
                        "scrape.listing",
                        actor="cli:scrape",
                        outcome="success",
                        target=f"{platform}:{listing.platform_id}",
                        file_only=True,
                    )
                if target is not None and len(known) >= target:
                    break
        except BlockedError as exc:
            log.emit(
                "scrape.blocked",
                actor="cli:scrape",
                outcome="failure",
                target=exc.host,
                consecutive_403=exc.count,
            )
            raise

    tier_total = write_tier(settings, platform, operation, tier)
    return ScrapeResult(
        platform=platform,
        operation=operation,
        tier=tier,
        pages_fetched=pages,
        new_listings=new_total,
        master_total=len(known),
        tier_total=tier_total,
    )
