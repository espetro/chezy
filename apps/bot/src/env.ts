// The single allowed reader of `process.env` in apps/bot (oxlint
// `no-restricted-properties` override). Mirrors apps/web/lib/env.ts shape:
// Valibot schema + `v.parse`, one `env` object for the whole package.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import * as v from "valibot";

const botDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Shared vars (POSTGRES_URL, OPENAI_COMPATIBLE_*, VIEWING_MODE) fall back to
// the web app's env files. Bot-local files (apps/bot/.env, .env.local) are
// loaded by src/index.ts at startup, not here, so tests keep full control of
// process.env. dotenv never overrides a var that is already set.
loadDotenv({
  path: [path.join(botDir, "../web/.env.local"), path.join(botDir, "../web/.env")],
  quiet: true,
});

const intFromString = (fallback: number) =>
  v.fallback(
    v.pipe(
      v.string(),
      v.transform((s) => Number.parseInt(s, 10)),
      v.integer(),
    ),
    fallback,
  );

const EnvSchema = v.object({
  POSTGRES_URL: v.optional(v.string()),

  // Telegram Bot API. Token may be absent in tests/boot smoke runs; the bot
  // still serves the Mastra Hono routes without connecting a channel.
  // Both spellings are accepted (BotFather exports it as an "API key"); the
  // resolved values are exposed as BOT_TOKEN / BOT_USERNAME below.
  TELEGRAM_BOT_TOKEN: v.optional(v.string()),
  TELEGRAM_BOT_API_KEY: v.optional(v.string()),
  TELEGRAM_BOT_USERNAME: v.optional(v.string()),
  TELEGRAM_BOT_NAME: v.optional(v.string()),
  TELEGRAM_API_BASE_URL: v.fallback(v.string(), "https://api.telegram.org"),
  // Comma-separated Telegram user ids allowed to talk to the bot. Empty/unset
  // means open to anyone (the judge is a stranger).
  TELEGRAM_ALLOWED_USER_IDS: v.optional(v.string()),

  BOT_PORT: intFromString(4111),
  // Bearer token guarding POST /internal/radar/run. Unset = route disabled.
  BOT_INTERNAL_TOKEN: v.optional(v.string()),

  // Same Nebius/OpenAI-compatible vars as apps/web.
  OPENAI_COMPATIBLE_BASE_URL: v.optional(v.string()),
  OPENAI_COMPATIBLE_API_KEY: v.optional(v.string()),
  CHEZY_MODEL_ID: v.optional(v.string()),

  // Radar loop. 15 min default; RADAR_MIN_SCORE matches the listing match
  // score scale (0-100) produced by apps/web/lib/match.ts.
  RADAR_INTERVAL_MS: intFromString(900_000),
  RADAR_MIN_SCORE: intFromString(70),
});

const parsed = v.parse(EnvSchema, process.env);

export const env = {
  ...parsed,
  // First spelling wins.
  BOT_TOKEN: parsed.TELEGRAM_BOT_TOKEN ?? parsed.TELEGRAM_BOT_API_KEY,
  BOT_USERNAME: parsed.TELEGRAM_BOT_USERNAME ?? parsed.TELEGRAM_BOT_NAME,
};
export type Env = typeof env;
