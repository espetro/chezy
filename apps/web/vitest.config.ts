// Mirrors the `~/*` -> `./*` path alias from tsconfig.json so modules under
// test resolve the same way under vitest as under Next/tsc.
import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // tests/e2e are Playwright specs (need @playwright/test); vendor/ is the
    // verbatim upstream template. Unit tests here are vitest-only.
    exclude: [...configDefaults.exclude, "tests/e2e/**", "vendor/**"],
  },
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "."),
    },
  },
});
