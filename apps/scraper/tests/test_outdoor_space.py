# pyright: basic
# pyarrow ships partial type information, so strict inference cannot resolve its API.
"""Per-listing outdoor space aggregation from per-photo labels."""

from __future__ import annotations

import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from chezy_scraper.outdoor_space import aggregate_outdoor_space, run


def test_all_none_is_none_label() -> None:
    assert aggregate_outdoor_space(["none", "none", "none"]) == "none"


def test_no_evidence_stays_unknown() -> None:
    assert aggregate_outdoor_space([]) is None
    assert aggregate_outdoor_space([None, None]) is None


def test_single_positive_among_none() -> None:
    assert aggregate_outdoor_space(["none", "balcony", "none", None]) == "balcony"


def test_majority_wins() -> None:
    assert aggregate_outdoor_space(["terrace", "terrace", "balcony"]) == "terrace"


def test_tie_break_order() -> None:
    assert aggregate_outdoor_space(["balcony", "terrace"]) == "terrace"
    assert aggregate_outdoor_space(["patio", "garden"]) == "garden"
    assert aggregate_outdoor_space(["patio", "balcony"]) == "balcony"


def test_unknown_strings_ignored() -> None:
    assert aggregate_outdoor_space(["rooftop", "yard"]) is None
    assert aggregate_outdoor_space(["rooftop", "none"]) == "none"
    assert aggregate_outdoor_space(["rooftop", "rooftop", "patio"]) == "patio"


def test_run_writes_one_line_per_listing_with_evidence(tmp_path: Path) -> None:
    rows = [
        ("fotocasa", "1", "none"),
        ("fotocasa", "1", "balcony"),
        ("fotocasa", "2", None),
        ("pisos", "3", "none"),
    ]
    table = pa.table(
        {
            "platform": [r[0] for r in rows],
            "platform_id": [r[1] for r in rows],
            "outdoor_space": [r[2] for r in rows],
        }
    )
    (tmp_path / "enriched").mkdir()
    pq.write_table(table, tmp_path / "enriched" / "media_features.parquet")

    result = run(tmp_path)

    lines = [json.loads(x) for x in result.out_path.read_text(encoding="utf-8").splitlines()]
    assert result.listings == 3
    assert result.labelled == 2
    assert lines == [
        {"platform": "fotocasa", "platform_id": "1", "outdoor_space": "balcony"},
        {"platform": "pisos", "platform_id": "3", "outdoor_space": "none"},
    ]


def test_run_fails_clearly_without_parquet(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match=r"media_features\.parquet"):
        run(tmp_path)
