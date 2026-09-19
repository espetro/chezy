"""Dataset tiers: small / medium / large.

Tiers are strict supersets. They are prefix slices of one master file kept in
first-seen order, so a feature validated on `small` re-runs on `medium` without
re-keying anything.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, Literal, get_args

from chezy_scraper.sinks.jsonl import master_path, read_listings, tier_path, write_listings

if TYPE_CHECKING:
    from chezy_scraper.config import Settings
    from chezy_scraper.models import Listing, Operation, Platform

Tier = Literal["small", "medium", "large"]
TIERS: Final[tuple[Tier, ...]] = get_args(Tier)

# `None` means "the full result set".
TIER_SIZES: Final[dict[Tier, int | None]] = {"small": 50, "medium": 500, "large": None}

# Tiers whose images are mirrored by default; large is URLs only unless asked.
MEDIA_BY_DEFAULT: Final[frozenset[Tier]] = frozenset({"small", "medium"})


def slice_tier(listings: list[Listing], tier: Tier) -> list[Listing]:
    size = TIER_SIZES[tier]
    return listings if size is None else listings[:size]


def write_tier(settings: Settings, platform: Platform, operation: Operation, tier: Tier) -> int:
    """Rewrite the tier file from the master; returns the record count."""
    master = read_listings(master_path(settings, platform, operation))
    return write_listings(tier_path(settings, platform, operation, tier), slice_tier(master, tier))
