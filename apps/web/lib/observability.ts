import { configureLogger, createAuditLogger } from "@chezy/observability";

/**
 * Run the LogTape configuration once per Next.js process.
 *
 * Called from `instrumentation.ts` (server boot) so both the request
 * runtime and any route handlers share the same audit JSONL sink.
 *
 * Re-entrant — safe to call from tests.
 */
let configured = false;
export async function setupLogging(): Promise<void> {
  if (configured) return;
  await configureLogger({ service: "chezy-web" });
  configured = true;
}

export const audit = createAuditLogger("chat");
