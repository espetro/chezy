import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.PLAYWRIGHT || process.env.CI_PLAYWRIGHT,
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

// Empty-chat prompts. Rental-agent copy; the template's generic prompts were replaced.
export const suggestions = [
  "Which neighbourhoods fit my budget best?",
  "Why is my top match ranked first?",
  "What should I check before a viewing?",
  "Can you book a viewing for my best match?",
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
// Product bar from docs/checkpoints/03-book-a-visit.md; the chat prompt gates
// arrangeViewing on it (searchListings flags `topMatches`).
export const AUTO_CALL_MATCH_THRESHOLD = 95;

// Deadline for outbound HTTP calls (client transport + third-party APIs);
// bounds a stalled gateway/provider so requests fail instead of hanging.
export const FETCH_TIMEOUT_MS = 10_000;

// Grace after an SLNG call ends before an un-booked viewing row is marked failed,
// so a late book_viewing webhook (/api/calendar) still wins.
export const LIVE_CALL_END_GRACE_MS = 15_000;

// The VLM call reads several photos and can legitimately take much longer
// than a plain API round trip.
export const VISION_FETCH_TIMEOUT_MS = 60_000;

// How long one rejection-triggered panel job may run before it is marked
// timed out; governs the deadline_at column.
export const ADAPTATION_DEADLINE_MS = 10 * 60_000;
// Client poll cadence lives in lib/flow/constants.ts: this module imports
// lib/db/utils (bcrypt, ai) and cannot ship in the client bundle.
// Candidates per run: the first output plus one autonomous correction after
// the validator rejects it (JES-13). A second rejection fails the job.
export const ADAPTATION_MAX_ATTEMPTS = 2;
// ACU cap for the Devin session; one small prompt-only job.
export const ADAPTATION_MAX_ACU = 1;
// Coverage below this threshold means the feed lacks usable capability evidence.
export const CAPABILITY_GAP_COVERAGE_THRESHOLD = 0.2;
// ACU cap for the capability forge session; matches scripts/devin-forge/forge.ts.
export const CAPABILITY_FORGE_MAX_ACU = 8;
// Branch the capability forge session starts from.
export const CAPABILITY_FORGE_BASE_BRANCH = "main";
// Feed candidates handed to the provider as the listing id allowlist.
export const ADAPTATION_CANDIDATE_LIMIT = 6;
// Outbound Devin API call bound, same role as FETCH_TIMEOUT_MS.
export const DEVIN_REQUEST_TIMEOUT_MS = 10_000;
