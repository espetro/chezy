"""JSONL is the source of truth on disk.

Layout under `Settings.data_dir`:

    raw/<platform>/<operation>/<run-id>/page-NNN.json   untouched source payloads
    listings/<platform>-<operation>.jsonl               master: first-seen order, deduped
    listings/<platform>-<operation>-<tier>.jsonl        prefix slices of the master
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from chezy_scraper.models import Listing

if TYPE_CHECKING:
    from collections.abc import Iterable

    from chezy_scraper.config import Settings
    from chezy_scraper.jsonx import JsonObj
    from chezy_scraper.models import Operation, Platform


def raw_page_path(
    settings: Settings, platform: Platform, operation: Operation, run_id: str, page: int
) -> Path:
    return settings.raw_dir / platform / operation / run_id / f"page-{page:03d}.json"


def write_raw_page(path: Path, payload: JsonObj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def master_path(settings: Settings, platform: Platform, operation: Operation) -> Path:
    return settings.listings_dir / f"{platform}-{operation}.jsonl"


def tier_path(settings: Settings, platform: Platform, operation: Operation, tier: str) -> Path:
    return settings.listings_dir / f"{platform}-{operation}-{tier}.jsonl"


def read_listings(path: Path) -> list[Listing]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as handle:
        return [Listing.model_validate_json(line) for line in handle if line.strip()]


def append_listings(path: Path, listings: Iterable[Listing]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        for listing in listings:
            handle.write(listing.model_dump_json() + "\n")


def write_listings(path: Path, listings: Iterable[Listing]) -> int:
    """Atomically replace `path`; returns the number of records written."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    count = 0
    with tmp.open("w", encoding="utf-8") as handle:
        for listing in listings:
            handle.write(listing.model_dump_json() + "\n")
            count += 1
    tmp.replace(path)
    return count
