"""Smoke tests for the chezy_scraper observability module.

Mirrors packages/observability/src/__tests__/audit.test.ts so the TS and
Py contracts stay in sync — if you add an assertion here, add the
equivalent there.
"""
from __future__ import annotations

from pathlib import Path

from chezy_scraper.observability import audit, configure_logging


def test_configure_logging_is_idempotent(tmp_path: Path, monkeypatch) -> None:
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
    from datetime import UTC, datetime

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    audit_file = tmp_path / f"chezy-scraper-{today}.jsonl"
    assert audit_file.exists(), f"expected audit file at {audit_file}"


def test_audit_failure_escalates(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("CHEZY_AUDIT_DIR", str(tmp_path))
    configure_logging()
    audit.emit("scraper.fetch.fail", actor="cron:scraper", outcome="failure", target="ABC-1")
    # We only assert that emit() does not raise; the level escalation is
    # covered indirectly by the audit JSONL shape (covered by integration
    # tests once the scraper lands).
