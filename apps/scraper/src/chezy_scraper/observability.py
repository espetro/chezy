"""Chezy scraper observability module.

Structured leveled logging + JSONL audit log for the scraper, mirroring
the @chezy/observability contract on the TS side so the same jq /
DuckDB / Vector tooling can ingest both. See packages/observability/README.md
for the contract; this module is the Python implementation.

Environment knobs:

    CHEZY_LOG_LEVEL      info|debug|warning|error   default: info
    CHEZY_AUDIT_DIR      path to daily JSONL files  default: .audit
    CHEZY_ENV            dev|staging|prod label     default: development

Usage:

    from chezy_scraper.observability import configure_logging, audit
    configure_logging()
    audit.info("scraper.fetch.start", listing_id="ABC-123", url="...")
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, Literal, cast

import structlog

__all__ = [
    "audit",
    "configure_logging",
]

LogLevel = Literal["trace", "debug", "info", "warning", "error", "fatal"]

_SERVICE_NAME: Final[str] = "chezy-scraper"
_DEFAULT_LEVEL: Final[LogLevel] = "info"
_LEVELS: Final[dict[str, int]] = {
    "trace": 5,
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR,
    "fatal": logging.CRITICAL,
}
_AUDIT_LOGGER: Final[str] = "chezy.audit"


def _resolve_level() -> LogLevel:
    raw = os.environ.get("CHEZY_LOG_LEVEL", _DEFAULT_LEVEL).lower()
    if raw not in _LEVELS:
        sys.stderr.write(
            f"chezy_scraper.observability: unknown CHEZY_LOG_LEVEL={raw!r}, "
            f"falling back to {_DEFAULT_LEVEL!r}\n",
        )
        return _DEFAULT_LEVEL
    return cast(LogLevel, raw)


def _resolve_audit_path() -> Path:
    audit_dir = Path(os.environ.get("CHEZY_AUDIT_DIR", ".audit"))
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    return audit_dir / f"{_SERVICE_NAME}-{date}.jsonl"


def _resolve_env() -> str:
    return os.environ.get("CHEZY_ENV") or os.environ.get("NODE_ENV") or "development"


def configure_logging(*, level: LogLevel | None = None) -> None:
    """Configure structlog + stdlib logging once per process.

    Idempotent: calling twice rebinds processors (useful in tests).

    Sinks:

    - stderr: ConsoleRenderer with ANSI colors when stderr is a TTY so
      `mise run scraper:dev` is readable. In CI / non-TTY, we switch to
      KeyValueRenderer for logfmt output that vector / fluentbit can parse.
    - audit JSONL: <CHEZY_AUDIT_DIR>/chezy-scraper-YYYY-MM-DD.jsonl.
      Each line is one record with `audit: true` plus the action string.
      Written directly by `audit.emit`, so it is independent of the stderr
      level filter.
    """
    resolved_level = level or _resolve_level()
    audit_path = _resolve_audit_path()
    audit_path.parent.mkdir(parents=True, exist_ok=True)

    stderr_renderer: structlog.types.Processor = (
        structlog.dev.ConsoleRenderer(colors=True)
        if sys.stderr.isatty()
        else structlog.processors.KeyValueRenderer(key_order=["timestamp", "level", "event"])
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            stderr_renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(_LEVELS[resolved_level]),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=False,
    )

    # Stdlib logging is the file sink for the audit JSONL: structlog ships no
    # file sink and the audit channel must not depend on the stderr level.
    audit_logger = logging.getLogger(_AUDIT_LOGGER)
    audit_logger.setLevel(logging.INFO)
    for handler in list(audit_logger.handlers):
        audit_logger.removeHandler(handler)
        handler.close()
    handler = logging.FileHandler(audit_path, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(message)s"))
    audit_logger.addHandler(handler)
    audit_logger.propagate = False


class _AuditChannel:
    """Slim audit channel that mirrors packages/observability/src/audit.ts.

    The shape of AuditEvent matches the TS contract one-to-one so the
    same downstream tooling (jq queries, DuckDB views) can read both.
    """

    def __init__(self, bindings: dict[str, object] | None = None) -> None:
        self._bindings: dict[str, object] = bindings or {}

    def emit(
        self,
        action: str,
        *,
        actor: str,
        outcome: Literal["success", "failure", "pending"],
        target: str | None = None,
        file_only: bool = False,
        **ctx: object,
    ) -> None:
        # `file_only` keeps high-volume events (one per listing) out of stderr.
        # Failures escalate from info to warning so alerting rules can
        # fire on level alone, identical to the TS AuditLogger behavior.
        level = "warning" if outcome == "failure" else "info"
        record: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": level,
            "service": _SERVICE_NAME,
            "env": _resolve_env(),
            "audit": True,
            "actor": actor,
            "action": action,
            "target": target,
            "outcome": outcome,
            **self._bindings,
            **ctx,
        }
        logging.getLogger(_AUDIT_LOGGER).info(json.dumps(record, default=str))
        if file_only:
            return
        log = structlog.get_logger(_AUDIT_LOGGER)
        (log.warning if outcome == "failure" else log.info)(
            action, **{k: v for k, v in record.items() if k not in {"timestamp", "level", "action"}}
        )

    def child(self, **bindings: object) -> _AuditChannel:
        """Return a channel whose `bindings` are defaults for every emit()."""
        return _AuditChannel({**self._bindings, **bindings})


# Singleton accessor. The verb is `audit.emit(action, outcome=...)` so the
# action string is always explicit and grep-friendly.
audit: Final[_AuditChannel] = _AuditChannel()
