# @chezy/observability

Structured leveled logging + JSONL audit log for every chezy service.

## What's in the box

- `configureLogger({ service, level?, environment?, auditFile? })` — runs
  once per process, configures LogTape with two sinks:
  - **stderr** — pretty ANSI for `mise run dev` / interactive terminals
  - **audit JSONL** — `${CHEZY_AUDIT_DIR:-.audit}/${service}-YYYY-MM-DD.jsonl`,
    one record per line, `jq`-friendly flat shape
- `createAuditLogger(subCategory)` — returns an `AuditLogger` whose
  `emit({ actor, action, target?, outcome, ctx? })` calls land in the
  audit JSONL with `audit: true` and an escaped action string.
- `rootLogger` — shared `["chezy"]` category root; sub-categories nest
  under it (e.g. `["chezy", "db"]`, `["chezy", "scraper"]`).

## Usage

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

## Rules

- Audit `action` strings are dotted, lower-case, present-tense verbs:
  `chat.turn.start`, `chat.message.persist`, `scraper.fetch.ok`,
  `scraper.fetch.fail`, `db.migrate.run`.
- `outcome` is one of `"success"`, `"failure"`, `"pending"`. A
  `"failure"` outcome auto-escalates from `info` to `warn` so alerting
  rules can fire on level alone.
- Never log raw PII, raw prompts, or full message bodies — log the
  message id and a precomputed hash instead.
