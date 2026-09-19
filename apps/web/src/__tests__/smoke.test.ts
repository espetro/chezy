/**
 * Day-0 smoke test. Removes vitest's "no test files found" exit code so the
 * validate gate stays green on the empty stub. Remove the moment a real test
 * ships in apps/web/src/**\/__tests__/.
 */
import { test, expect } from "vitest";

test("smoke", () => {
  expect(true).toBe(true);
});
