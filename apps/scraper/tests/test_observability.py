"""Smoke tests for the chezy_scraper observability module.

Mirrors packages/observability/src/__tests__/audit.test.ts so the TS and
Py contracts stay in sync — if you add an assertion here, add the
equivalent there.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from chezy_scraper.observability import audit, configure_logging


def test_configure_logging_is_idempotent(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHEZY_AUDIT_DIR", str(tmp_path))
    configure_logging()
    configure_logging()  # second call must not raise
    audit.emit(
        "test.boot",
        actor="system",
        outcome="success",
        target=None,
        build="dev",
    )
    # Audit JSONL file was created with today's date and the right service name.
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    audit_file = tmp_path / f"chezy-scraper-{today}.jsonl"
    assert audit_file.exists(), f"expected audit file at {audit_file}"
    record = json.loads(audit_file.read_text().splitlines()[-1])
    assert record["action"] == "test.boot"
    assert record["service"] == "chezy-scraper"
    assert record["audit"] is True


def test_audit_failure_escalates(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHEZY_AUDIT_DIR", str(tmp_path))
    configure_logging()
    audit.emit("scraper.fetch.fail", actor="cron:scraper", outcome="failure", target="ABC-1")
    audit_file = next(tmp_path.glob("chezy-scraper-*.jsonl"))
    record = json.loads(audit_file.read_text().splitlines()[-1])
    assert record["level"] == "warning"
    assert record["outcome"] == "failure"


def test_child_bindings_apply(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHEZY_AUDIT_DIR", str(tmp_path))
    configure_logging()
    audit.child(run_id="r1").emit("scrape.page", actor="system", outcome="success", page=1)
    audit_file = next(tmp_path.glob("chezy-scraper-*.jsonl"))
    record = json.loads(audit_file.read_text().splitlines()[-1])
    assert record["run_id"] == "r1"
    assert record["page"] == 1
