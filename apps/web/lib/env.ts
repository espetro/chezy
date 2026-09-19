// The single allowed reader of `process.env` in apps/web. `.oxlintrc.json`
// exempts this file from the no-restricted-syntax `process.env` ban; every
// other module imports the parsed `env` object instead. Valibot is the
// validator (Zod is banned).
import * as v from "valibot";

const ViewingModeSchema = v.picklist(["mock", "slng", "vonage"]);
const CalendarModeSchema = v.picklist(["mock", "google"]);

const EnvSchema = v.object({
  POSTGRES_URL: v.optional(v.string()),
  AUTH_SECRET: v.optional(v.string()),

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

  // OpenAI-compatible chat provider (Nebius AI Studio) — chat, embeddings
  // (lib/ai/embeddings.ts) + VLM calls.
  OPENAI_COMPATIBLE_BASE_URL: v.optional(v.string()),
  OPENAI_COMPATIBLE_API_KEY: v.optional(v.string()),
  // Vision model for photo insights. Kimi-K3 needs thinking off; gemma-3-27b
  // is the cheap fallback.
  VISION_MODEL_ID: v.fallback(v.string(), "moonshotai/Kimi-K3"),
  CHEZY_EMBEDDING_MODEL_ID: v.fallback(
    v.string(),
    "Qwen/Qwen3-Embedding-8B",
  ),
  CHEZY_MEMORY_RECALL_LIMIT: v.fallback(
    v.pipe(v.string(), v.transform(Number)),
    8,
  ),
});

export const env = v.parse(EnvSchema, process.env);
export type Env = v.InferOutput<typeof EnvSchema>;
