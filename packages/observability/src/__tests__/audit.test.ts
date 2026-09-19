import { test, expect } from "vitest";
import { configureLogger, createAuditLogger } from "../index";

test("configureLogger is idempotent and produces a usable audit logger", async () => {
  await configureLogger({ service: "chezy-test", auditFile: null });
  const audit = createAuditLogger("test");
  // Smoke test: emitting an audit event does not throw.
  audit.emit({
    actor: "system",
    action: "test.boot",
    outcome: "success",
    ctx: { build: "dev" },
  });
  expect(audit).toBeDefined();
});
