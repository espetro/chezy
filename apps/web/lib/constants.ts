import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
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
