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

import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final, Literal

import structlog

__all__ = [
    "configure_logging",
    "audit",
    "AuditEvent",
]

LogLevel = Literal["trace", "debug", "info", "warning", "error", "fatal"]

_SERVICE_NAME: Final[str] = "chezy-scraper"
_DEFAULT_LEVEL: Final[LogLevel] = "info"


def _resolve_level() -> LogLevel:
    raw = os.environ.get("CHEZY_LOG_LEVEL", _DEFAULT_LEVEL).lower()
    if raw not in {"trace", "debug", "info", "warning", "error", "fatal"}:
        sys.stderr.write(
            f"chezy_scraper.observability: unknown CHEZY_LOG_LEVEL={raw!r}, "
            f"falling back to {_DEFAULT_LEVEL!r}\n",
        )
        return _DEFAULT_LEVEL
    return raw  # type: ignore[return-value]


def _resolve_audit_path() -> Path:
    audit_dir = Path(os.environ.get("CHEZY_AUDIT_DIR", ".audit"))
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    return audit_dir / f"{_SERVICE_NAME}-{date}.jsonl"


def _resolve_env() -> str:
    return os.environ.get("CHEZY_ENV") or os.environ.get("NODE_ENV") or "development"


def configure_logging(*, level: LogLevel | None = None) -> None:
    """Configure structlog + stdlib logging once per process.

    Idempotent — calling twice rebinds processors (useful in tests).

    Sinks:

    - stderr: ConsoleRenderer with ANSI colors (when stderr is a TTY) so
      `mise run scraper:dev` is readable. In CI / non-TTY, we switch to
      KeyValueRenderer for logfmt output that vector / fluentbit can parse.
    - audit JSONL: <CHEZY_AUDIT_DIR>/chezy-scraper-YYYY-MM-DD.jsonl.
      Each line is one record with `audit: true` plus the action string.
    """
    resolved_level = level or _resolve_level()
    env = _resolve_env()
    audit_path = _resolve_audit_path()
    audit_path.parent.mkdir(parents=True, exist_ok=True)

    is_tty = sys.stderr.isatty()
    stderr_renderer = (
        structlog.dev.ConsoleRenderer(colors=True)
        if is_tty or env != "development"
        else structlog.dev.KeyValueRenderer()
    )

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    structlog.configure(
        processors=[
            *shared_processors,
            _audit_tagging_processor,
            structlog.stdlib.ProcessorFactory(
                wrapper_class=structlog.stdlib.BoundLogger,
            ),
            stderr_renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, resolved_level.upper()),
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )

    # Stdlib logging → file sink for the audit JSONL. stdlib is used here
    # because structlog doesn't ship a file sink and we want the audit
    # channel to be independent of the stderr channel's level filter.
    audit_logger = logging.getLogger("chezy.audit")
    audit_logger.setLevel(logging.INFO)
    audit_logger.handlers.clear()
    audit_logger.addHandler(
        logging.FileHandler(audit_path, encoding="utf-8"),
    )
    audit_logger.propagate = False


def _audit_tagging_processor(
    _logger: Any,
    _method_name: str,
    event_dict: structlog.types.EventDict,
) -> structlog.types.EventDict:
    """Tag audit events so jq queries can filter cheaply.

    If the caller passed `audit=True` in the binding context, every record
    emitted downstream carries `audit=true` so consumers can do
    `jq 'select(.audit)' .audit/chezy-scraper-2026-09-19.jsonl`.
    """
    if event_dict.get("audit") is True:
        event_dict.setdefault("service", _SERVICE_NAME)
    return event_dict


class _AuditChannel:
    """Slim audit channel that mirrors packages/observability/src/audit.ts.

    The shape of AuditEvent matches the TS contract one-to-one so the
    same downstream tooling (jq queries, DuckDB views) can read both.
    """

    def emit(
        self,
        action: str,
        *,
        actor: str,
        outcome: Literal["success", "failure", "pending"],
        target: str | None = None,
        **ctx: Any,
    ) -> None:
        log = structlog.get_logger("chezy.audit").bind(
            audit=True,
            actor=actor,
            action=action,
            target=target,
            outcome=outcome,
        )
        # Failures escalate from info to warning so alerting rules can
        # fire on level alone, identical to the TS AuditLogger behavior.
        method = log.warning if outcome == "failure" else log.info
        method(action, **ctx)

    def child(self, **bindings: Any) -> "_AuditChannel":
        # Bindings become defaults for every subsequent emit() call.
        bound = _AuditChannel()
        bound._bindings = bindings  # type: ignore[attr-defined]
        return bound


# Singleton accessor. `audit.info(...)`, `audit.failure(...)` not exposed
# because we want the verb to be `audit.emit(action, outcome=...)` so the
# action string is always explicit and grep-friendly.
audit: Final[_AuditChannel] = _AuditChannel()


# Convenience aliases that look like the structlog stdlib API but route
# through the audit channel with a default outcome of "pending". Used by
# the scraper for non-failure, non-success events where "in flight" is
# the truthful label.
def info(action: str, *, actor: str = "system", target: str | None = None, **ctx: Any) -> None:
    audit.emit(action, actor=actor, outcome="pending", target=target, **ctx)
