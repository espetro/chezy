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

// Rough Barcelona metro pace incl. transfers; demo estimate, not routing.
export const COMMUTE_MIN_PER_KM = 3.2;
// Fixed leg overhead (walk to stop, wait, walk to door); demo estimate.
export const COMMUTE_OVERHEAD_MIN = 6;
// Feed candidates may exceed maxPrice by 15% so near-misses can still rank.
export const PRICE_HEADROOM = 1.15;
