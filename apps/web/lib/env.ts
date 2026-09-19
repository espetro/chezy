// The single allowed reader of `process.env` in apps/web. `.oxlintrc.json`
// exempts this file from the no-restricted-properties `process.env` ban; every
// other module imports the parsed `env` object instead. Valibot is the
// validator (Zod is banned).
//
// Genuine config-bound files stay exempt from the ban instead of importing
// from here (they run before/outside Next's env inlining or inside build
// tooling): next.config.ts, drizzle.config.ts, playwright.config.ts,
// proxy.ts, instrumentation.ts, lib/db/migrate.ts (standalone tsx entry).
// `process.env.NODE_ENV` in lib/constants.ts is likewise exempt: it must
// reflect the actual build mode, not a value captured at import time.
import * as v from "valibot";

const ViewingModeSchema = v.picklist(["mock", "slng", "vonage"]);
const CalendarModeSchema = v.picklist(["mock", "google"]);

const EnvSchema = v.object({
  POSTGRES_URL: v.optional(v.string()),
  AUTH_SECRET: v.optional(v.string()),
  NEXT_PUBLIC_BASE_PATH: v.optional(v.string()),

  // Vonage Voice API (server-side only).
  VONAGE_API_KEY: v.optional(v.string()),
  VONAGE_API_SECRET: v.optional(v.string()),
  VONAGE_FROM_NUMBER: v.optional(v.string()),
  VONAGE_APPLICATION_ID: v.optional(v.string()),
  VONAGE_PRIVATE_KEY_PATH: v.optional(v.string()),
  VONAGE_PRIVATE_KEY: v.optional(v.string()),

  // SLNG Voice Agents API.
  SLNG_API_KEY: v.optional(v.string()),
  SLNG_AGENT_ID: v.optional(v.string()),

  // Behaviour switches. Default to `mock` so the demo never blocks on a
  // provider being configured.
  VIEWING_MODE: v.fallback(ViewingModeSchema, "mock"),
  CALENDAR_MODE: v.fallback(CalendarModeSchema, "mock"),

  GOOGLE_CALENDAR_ID: v.optional(v.string()),
  GOOGLE_SERVICE_ACCOUNT_JSON_PATH: v.optional(v.string()),

  APP_BASE_URL: v.fallback(v.string(), "http://localhost:3000"),

  // OpenAI-compatible chat provider (Nebius AI Studio) — chat + VLM calls.
  OPENAI_COMPATIBLE_BASE_URL: v.optional(v.string()),
  OPENAI_COMPATIBLE_API_KEY: v.optional(v.string()),
  CHEZY_MODEL_ID: v.optional(v.string()),
  CHEZY_TITLE_MODEL_ID: v.optional(v.string()),

  // Upstash-style Redis for resumable streams + rate limiting. Absent =
  // in-memory fallbacks.
  REDIS_URL: v.optional(v.string()),

  // Demo build switch (`next build` bakes IS_DEMO into NEXT_PUBLIC_BASE_PATH).
  IS_DEMO: v.optional(v.string()),

  // Vision model for photo insights. Kimi-K3 needs thinking off; gemma-3-27b
  // is the cheap fallback.
  VISION_MODEL_ID: v.fallback(v.string(), "moonshotai/Kimi-K3"),
});

export const env = v.parse(EnvSchema, process.env);
export type Env = v.InferOutput<typeof EnvSchema>;
