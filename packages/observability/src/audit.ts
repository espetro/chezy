import { getLogger, type Logger } from "@logtape/logtape";

import { rootLogger } from "./logger";

/**
 * Every recordable event in chezy — auth, chat turn, scraper fetch,
 * db write, etc. The shape is intentionally flat so that downstream
 * tools (jq, DuckDB, Vector) can ingest it without schema work.
 *
 *  ts        ISO-8601 timestamp, ms precision
 *  level     LogTape level (trace|debug|info|warn|error|fatal)
 *  actor     Who initiated the event (user id, "system", "cron:...")
 *  action    Verbs in dotted notation: "chat.turn.start", "scraper.fetch"
 *  target    Object id the action touched: chat id, listing id, ...
 *  outcome   "success" | "failure" | "pending"
 *  ctx       Free-form kv: latency_ms, model, prompt_tokens, ...
 */
export interface AuditEvent {
  actor: string;
  action: string;
  target?: string;
  outcome: "success" | "failure" | "pending";
  ctx?: Record<string, unknown>;
}

export interface AuditLogger {
  emit(event: AuditEvent): void;
  child(bindings: Record<string, unknown>): AuditLogger;
}

function buildAuditLogger(logger: Logger): AuditLogger {
  const emit = (event: AuditEvent): void => {
    const { actor, action, target, outcome, ctx = {} } = event;
    // LogTape renders `{placeholder}`s from the same properties record
    // that lands in the JSONL sink, so the flat audit payload doubles
    // as the template bindings.
    const properties: Record<string, unknown> = {
      audit: true,
      actor,
      action,
      target: target ?? "n/a",
      outcome,
      ...ctx,
    };
    // Audit events always emit at info unless the outcome was a failure
    // (which we escalate to warn so monitoring rules can fire without
    // parsing the ctx).
    if (outcome === "failure") {
      logger.warn("{actor} {action} failed on {target}", properties);
    } else {
      logger.info("{actor} {action} {outcome} on {target}", properties);
    }
  };

  const child = (bindings: Record<string, unknown>): AuditLogger =>
    buildAuditLogger(logger.with(bindings));

  return { emit, child };
}

/**
 * Build an audit logger scoped under a sub-category, e.g.
 *
 *   const audit = createAuditLogger("db");
 *   audit.emit({ actor: "system", action: "chat.insert", ... });
 *
 * The resulting category is `["chezy", "<sub>"]`. The full hierarchical
 * path lands in the JSONL sink so jq queries like
 *
 *   jq 'select(.category | tostring | contains("chezy.db"))' \
 *     .audit/chezy-web-2026-09-19.jsonl
 *
 * work without grep gymnastics.
 */
export function createAuditLogger(subCategory: string): AuditLogger {
  const logger = getLogger([...rootLogger.category, subCategory]);
  return buildAuditLogger(logger);
}
