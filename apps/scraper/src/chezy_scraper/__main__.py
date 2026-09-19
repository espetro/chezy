"""Chezy scraper CLI entry point.

Day-0 scope: prints a hello message and emits one audit event so the
JSONL pipeline is exercised end-to-end. Real commands land as features
ship.
"""

from __future__ import annotations

from chezy_scraper.observability import audit, configure_logging


def main() -> int:
    """CLI entry point. Returns the process exit code."""
    configure_logging()
    audit.emit(
        "cli.boot",
        actor="user",
        outcome="success",
        target=None,
        version="0.0.0",
    )
    print("chezy-scraper 0.0.0 (day-0 stub — no scraping yet)")
    print("See apps/scraper/README.md for the planned pipeline.")
    print("Audit JSONL: $CHEZY_AUDIT_DIR (default .audit/)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
