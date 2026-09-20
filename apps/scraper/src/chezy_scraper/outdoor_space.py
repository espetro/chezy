# pyright: basic
# pyarrow ships partial type information, so strict inference cannot resolve its API.
"""Per-listing outdoor space from the per-photo VLM labels.

Reads `<root>/enriched/media_features.parquet` (one row per photo, see `enrich_media`),
folds the `outdoor_space` labels of each (platform, platform_id) into a single value and
writes `<root>/enriched/listing_outdoor_space.jsonl`, one line per listing with evidence:
`{"platform": ..., "platform_id": ..., "outdoor_space": ...}`.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final

import pyarrow.parquet as pq

if TYPE_CHECKING:
    from collections.abc import Sequence

# Tie-break order among positive labels: the more valuable space wins.
POSITIVE_LABELS: Final = ("terrace", "balcony", "garden", "patio")
NONE_LABEL: Final = "none"
_RANK: Final = {label: index for index, label in enumerate(POSITIVE_LABELS)}


@dataclass(frozen=True)
class AggregateResult:
    listings: int
    labelled: int
    out_path: Path


def aggregate_outdoor_space(labels: Sequence[str | None]) -> str | None:
    """Most frequent positive label, else `"none"` if any photo said so, else `None`."""
    counts = Counter(label for label in labels if label in _RANK)
    if counts:
        return min(counts, key=lambda label: (-counts[label], _RANK[label]))
    if NONE_LABEL in labels:
        return NONE_LABEL
    return None


def _read_labels(root: Path) -> dict[tuple[str, str], list[str | None]]:
    source = root / "enriched" / "media_features.parquet"
    if not source.is_file():
        msg = f"{source}: missing; run `scraper enrich-media --dataset {root}` first"
        raise FileNotFoundError(msg)
    table = pq.read_table(source, columns=["platform", "platform_id", "outdoor_space"])
    grouped: dict[tuple[str, str], list[str | None]] = {}
    for row in table.to_pylist():
        grouped.setdefault((row["platform"], row["platform_id"]), []).append(row["outdoor_space"])
    return dict(sorted(grouped.items()))


def run(root: Path) -> AggregateResult:
    grouped = _read_labels(root)
    out = root / "enriched" / "listing_outdoor_space.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    labelled = 0
    with out.open("w", encoding="utf-8") as sink:
        for (platform, platform_id), labels in grouped.items():
            value = aggregate_outdoor_space(labels)
            if value is None:
                continue
            record = {"platform": platform, "platform_id": platform_id, "outdoor_space": value}
            sink.write(json.dumps(record, ensure_ascii=False) + "\n")
            labelled += 1
    return AggregateResult(len(grouped), labelled, out)
