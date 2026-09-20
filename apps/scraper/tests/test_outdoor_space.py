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


@pytest.mark.parametrize(
    ("labels", "expected"),
    [
        (["none", "none", "none"], "none"),
        ([], None),
        ([None, None], None),
        (["none", "balcony", "none"], "balcony"),
        (["terrace", "terrace", "balcony"], "terrace"),
        (["balcony", "terrace"], "terrace"),
        (["patio", "garden"], "garden"),
        (["rooftop", "pool", None], None),
        (["rooftop", "none"], "none"),
        (["rooftop", "patio", "none"], "patio"),
    ],
)
def test_aggregate_outdoor_space(labels: list[str | None], expected: str | None) -> None:
    assert aggregate_outdoor_space(labels) == expected


def test_run_writes_one_line_per_labelled_listing(tmp_path: Path) -> None:
    enriched = tmp_path / "enriched"
    enriched.mkdir()
    rows = [
        ("fotocasa", "1", 0, "none"),
        ("fotocasa", "1", 1, "balcony"),
        ("fotocasa", "2", 0, None),
        ("pisos", "3", 0, "none"),
    ]
    table = pa.table(
        {
            "platform": [r[0] for r in rows],
            "platform_id": [r[1] for r in rows],
            "position": [r[2] for r in rows],
            "outdoor_space": [r[3] for r in rows],
        }
    )
    pq.write_table(table, enriched / "media_features.parquet")

    result = run(tmp_path)

    assert result.listings == 3
    assert result.labelled == 2
    lines = [json.loads(x) for x in result.out_path.read_text().splitlines()]
    assert lines == [
        {"platform": "fotocasa", "platform_id": "1", "outdoor_space": "balcony"},
        {"platform": "pisos", "platform_id": "3", "outdoor_space": "none"},
    ]
