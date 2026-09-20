import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.PLAYWRIGHT || process.env.CI_PLAYWRIGHT,
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

export const suggestions = [
  "What are the advantages of using Next.js?",
  "Write code to demonstrate Dijkstra's algorithm",
  "Help me write an essay about Silicon Valley",
  "What is the weather in San Francisco?",
];

// Demo coverage is Barcelona city only — the dataset/scraper only contain
// Barcelona listings, so onboarding asks for neighborhoods, not cities.
export const COVERAGE_CITY = "Barcelona";

// Fallback gateway for local dev: a bifrost instance on this machine.
// OPENAI_COMPATIBLE_BASE_URL (see .env.example) overrides it everywhere.
export const DEFAULT_PROVIDER_BASE_URL = "http://localhost:8317/v1";

// Chat model used when CHEZY_MODEL_ID is unset.
export const DEFAULT_CHAT_MODEL_ID = "deepseek-ai/DeepSeek-V4.1-Flash";

// SLNG resolves the LiveKit project from (region, orchestrator). Only
// us-east | eu-central | ap-south exist; pipecat has no EU deployment, and
// the chezy-vonage connection lives in the eu-central/livekit project.
export const SLNG_AGENT_REGION = "eu-central";
export const SLNG_AGENT_ORCHESTRATOR = "livekit";
export const SLNG_API_BASE_URL = "https://api.agents.slng.ai";

// Qwen3-embedding cosine, tuned by eyeball; raise if near-duplicates slip through.
export const MEMORY_COSINE_DEDUP_THRESHOLD = 0.08;
// top-k injected into prompt.
export const MEMORY_RECALL_LIMIT = 8;
// extraction prompt bound.
export const MEMORY_MAX_CONTENT_CHARS = 500;

// Rough Barcelona metro pace incl. transfers; demo estimate, not routing.
export const COMMUTE_MIN_PER_KM = 3.2;
// Fixed leg overhead (walk to stop, wait, walk to door); demo estimate.
export const COMMUTE_OVERHEAD_MIN = 6;
// Feed candidates may exceed maxPrice by 15% so near-misses can still rank.
export const PRICE_HEADROOM = 1.15;

// Match score at/above which the agent may propose arranging a viewing call.
// Product bar from .agents/docs/demo-flow.md beat 3; the chat prompt gates
// arrangeViewing on it (searchListings flags `topMatches`).
export const AUTO_CALL_MATCH_THRESHOLD = 95;

// Deadline for outbound HTTP calls (client transport + third-party APIs);
// bounds a stalled gateway/provider so requests fail instead of hanging.
export const FETCH_TIMEOUT_MS = 10_000;

// The VLM call reads several photos and can legitimately take much longer
// than a plain API round trip.
export const VISION_FETCH_TIMEOUT_MS = 60_000;
