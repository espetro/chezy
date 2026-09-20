# pyright: basic
# pyarrow ships partial type information, so strict inference cannot resolve its API.
"""Per-listing outdoor space from the per-photo labels in `enriched/media_features.parquet`.

Every photo is labelled `outdoor_space` in {none, balcony, terrace, patio, garden} (or null
when the model could not judge). A listing gets the most frequent positive label across its
photos, a `none` when photos were judged and none showed outdoor space, and stays unknown
when there is no evidence at all. The result is written to
`<root>/enriched/listing_outdoor_space.jsonl` for the web seed to merge into
`Listing.outdoorSpace`.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

import pyarrow.parquet as pq

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

NONE_LABEL: Final = "none"
# Tie-break order: the larger / more valuable space wins when counts are equal.
POSITIVE_LABELS: Final[tuple[str, ...]] = ("terrace", "balcony", "garden", "patio")
_RANK: Final = {label: index for index, label in enumerate(POSITIVE_LABELS)}


def aggregate_outdoor_space(labels: Sequence[str | None]) -> str | None:
    """Collapse per-photo labels into one listing label; `None` when nothing was judged."""
    counts = Counter(label for label in labels if label in _RANK)
    if counts:
        return min(counts, key=lambda label: (-counts[label], _RANK[label]))
    if NONE_LABEL in labels:
        return NONE_LABEL
    return None


@dataclass(frozen=True)
class AggregateResult:
    listings: int
    labelled: int
    out_path: Path


def read_labels(features: Path) -> dict[tuple[str, str], list[str | None]]:
    table = pq.read_table(features, columns=["platform", "platform_id", "outdoor_space"])
    grouped: dict[tuple[str, str], list[str | None]] = {}
    for row in table.to_pylist():
        grouped.setdefault((row["platform"], row["platform_id"]), []).append(row["outdoor_space"])
    return dict(sorted(grouped.items()))


def run(root: Path) -> AggregateResult:
    """Read `<root>/enriched/media_features.parquet`, write `listing_outdoor_space.jsonl`."""
    grouped = read_labels(root / "enriched" / "media_features.parquet")
    out = root / "enriched" / "listing_outdoor_space.jsonl"
    labelled = 0
    with out.open("w", encoding="utf-8") as fh:
        for (platform, platform_id), labels in grouped.items():
            outdoor_space = aggregate_outdoor_space(labels)
            if outdoor_space is None:
                continue
            line = {
                "platform": platform,
                "platform_id": platform_id,
                "outdoor_space": outdoor_space,
            }
            fh.write(json.dumps(line, ensure_ascii=False) + "\n")
            labelled += 1
    return AggregateResult(len(grouped), labelled, out)
