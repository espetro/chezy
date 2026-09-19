# `@chezy/observability` — agent instructions

Scope: structured leveled logging + JSONL audit log for every chezy
service. The single sanctioned facade over LogTape (TS) and structlog
(Py). Inherits root [`AGENTS.md`](../../AGENTS.md) rules; this file adds
observability-specific invariants.

## What's in this package

- `configureLogger({ service, level?, environment?, auditFile? })` —
  runs once per process, configures LogTape with two sinks:
  - **stderr** — pretty ANSI for `mise run dev` / interactive
    terminals.
  - **audit JSONL** — `${CHEZY_AUDIT_DIR:-.audit}/${service}-YYYY-MM-DD.jsonl`,
    one record per line, `jq`-friendly flat shape.
- `createAuditLogger(subCategory)` — returns an `AuditLogger` whose
  `emit({ actor, action, target?, outcome, ctx? })` calls land in the
  audit JSONL with `audit: true` and an escaped action string.
- `rootLogger` — shared `["chezy"]` category root; sub-categories nest
  under it (e.g. `["chezy", "db"]`, `["chezy", "scraper"]`).

## Sole touchpoint

This package is the only place in the TS monorepo that imports LogTape
directly. App code calls the facade; it never imports
`@logtape/logtape` from `apps/*` or `packages/*` other than this one.
The Python equivalent (`apps/scraper/src/chezy_scraper/obs.py`)
mirrors this — structlog configuration lives in one module; scraper
code imports the configured logger, not structlog itself.

Do NOT:

- Import `@logtape/logtape` from app code. Import `structlog` from app
  code (the scraper's `obs.py` re-exports the configured logger).
- Re-initialize LogTape / structlog from a route handler, scraper
  module, or app entrypoint. Call `configureLogger({...})` ONCE per
  process.
- Create a per-app logging wrapper, a sibling facade, or a second
  audit sink. New signals extend THIS package.
- Register a second global LogTape root or structlog `Configure`
  chain. The facade owns one registration per process.

App contract:

```ts
// apps/web/instrumentation.ts
import { configureLogger, createAuditLogger } from "@chezy/observability";

await configureLogger({ service: "chezy-web" });
export const audit = createAuditLogger("chat");
audit.emit({
  actor: session.userId,
  action: "chat.turn.complete",
  target: messageId,
  outcome: "success",
  ctx: { latency_ms, model, prompt_tokens, completion_tokens },
});
```

## Environment knobs

| Env var               | Default       | Effect                                     |
| --------------------- | ------------- | ------------------------------------------ |
| `CHEZY_LOG_LEVEL`     | `info`        | Minimum level emitted to all sinks         |
| `CHEZY_AUDIT_DIR`     | `.audit`      | Directory for the daily JSONL audit file   |
| `NODE_ENV`            | `development` | Toggles pretty ANSI vs raw output          |

## Audit action vocabulary

Audit `action` strings are dotted, lower-case, present-tense verbs:

- `chat.turn.start`, `chat.message.persist`, `chat.message.stream`
- `scraper.fetch.ok`, `scraper.fetch.fail`, `scraper.parse.error`
- `db.migrate.run`, `db.query.slow`

`outcome` is one of `"success"`, `"failure"`, `"pending"`. A
`"failure"` outcome auto-escalates from `info` to `warn` so alerting
rules can fire on level alone.

## Never log secrets

Never log raw API keys, raw prompts, full message bodies, or raw PII.
Log the message id, the request id, or a precomputed hash instead.
Secrets that land in `.env.local` and get committed will not appear in
the audit log (the audit records **presence** of the key, not the
value — see [`packages/config`](../../packages/config/AGENTS.md)).

## Adding a new entrypoint

1. `await configureLogger({ service: "chezy-<name>" })` once at boot.
2. Use `rootLogger.getChild("sub-category")` for module-scoped loggers.
3. Use `createAuditLogger("sub-category")` for actions that need to
   land in the JSONL audit (anything security- or billing-relevant).

That is the whole integration. Nothing else needs to know LogTape or
structlog exists.