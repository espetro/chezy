"""Pipeline + tiers end to end with fixture HTML served by a mock transport."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from chezy_scraper.adapters.base import extract_script_json
from chezy_scraper.adapters.fotocasa import FotocasaAdapter
from chezy_scraper.config import Settings
from chezy_scraper.fetch.http import HttpFetcher
from chezy_scraper.jsonx import arr, dig, integer, obj
from chezy_scraper.pipeline import scrape
from chezy_scraper.sinks.jsonl import master_path, read_listings, tier_path

FIXTURE = Path(__file__).parent / "fixtures" / "fotocasa_rent.html"
NOW = datetime(2026, 9, 19, tzinfo=UTC)


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        data_dir=tmp_path / "data",
        media_root=tmp_path / "media",
        database_url="postgresql://unused",
        cdp_url="http://127.0.0.1:0",
        chrome_profile_dir=tmp_path / "chrome",
    )


def _page_for(page: int) -> str:
    """The fixture page with per-page unique ids so pages do not dedupe away."""
    payload = extract_script_json(FIXTURE.read_text(encoding="utf-8"), "__initial_props__")
    for item in arr(dig(payload, "initialSearch", "result", "realEstates")):
        listing = obj(item)
        listing["id"] = page * 1_000_000 + (integer(listing["id"]) or 0) % 1_000_000
    doc = json.dumps(payload)
    return f'<script type="application/json" id="__initial_props__">{doc}</script>'


def _fetcher(settings: Settings, pages_served: list[str]) -> HttpFetcher:
    def handler(request: httpx.Request) -> httpx.Response:
        pages_served.append(str(request.url))
        tail = str(request.url).rsplit("/", 1)[-1]
        return httpx.Response(200, text=_page_for(int(tail) if tail.isdigit() else 1))

    return HttpFetcher(
        settings.cache_dir,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
        sleep=lambda _: None,
    )


def test_scrape_small_writes_raw_master_and_tier(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CHEZY_AUDIT_DIR", str(tmp_path / "audit"))
    settings = _settings(tmp_path)
    served: list[str] = []
    result = scrape(
        FotocasaAdapter(),
        _fetcher(settings, served),
        settings,
        "rent",
        "small",
        run_id="run1",
        scraped_at=NOW,
    )
    assert result.tier_total == len(read_listings(tier_path(settings, "fotocasa", "rent", "small")))
    assert result.tier_total == 50
    assert result.master_total >= result.tier_total  # whole pages are appended
    assert (settings.raw_dir / "fotocasa" / "rent" / "run1" / "page-001.json").exists()
    assert json.loads((settings.raw_dir / "fotocasa/rent/run1/page-001.json").read_text())
    assert result.pages_fetched == len(served)


def test_tiers_are_prefix_supersets_and_rerun_is_free(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CHEZY_AUDIT_DIR", str(tmp_path / "audit"))
    settings = _settings(tmp_path)
    served: list[str] = []
    fetcher = _fetcher(settings, served)
    adapter = FotocasaAdapter()

    scrape(adapter, fetcher, settings, "rent", "small", run_id="a", scraped_at=NOW)
    small_first = [
        x.platform_id for x in read_listings(tier_path(settings, "fotocasa", "rent", "small"))
    ]
    requests_after_small = len(served)

    # Same tier again: master already fills it, so zero requests.
    again = scrape(adapter, fetcher, settings, "rent", "small", run_id="b", scraped_at=NOW)
    assert again.pages_fetched == 0
    assert len(served) == requests_after_small

    master = [x.platform_id for x in read_listings(master_path(settings, "fotocasa", "rent"))]
    assert master[: len(small_first)] == small_first
    assert len(master) == len(set(master))
