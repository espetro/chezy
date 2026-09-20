import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const botDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^~\/components\/chat\//,
        replacement: path.resolve(botDir, "src/shims/chat-components.ts"),
      },
      { find: /^~\//, replacement: `${path.resolve(botDir, "../web")}/` },
      {
        find: "server-only",
        replacement: path.resolve(botDir, "src/shims/server-only.ts"),
      },
    ],
  },
  test: {
    testTimeout: 120_000,
    env: {
      TELEGRAM_BOT_TOKEN: "fake-token",
      VIEWING_MODE: "mock",
      CALENDAR_MODE: "mock",
      POSTGRES_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    },
  },
});
