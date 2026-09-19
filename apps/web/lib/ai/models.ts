// chezy: replaced upstream's hardcoded https://ai-gateway.vercel.sh/v1/models
// URL with a fetch against the openai-compatible provider's `/v1/models`
// endpoint (bifrost by default). The shape (`{ data: [{ id, name }] }`)
// is identical for any OpenAI-compatible gateway, so we keep the rest of
// the upstream code intact.
//
// Env vars are read through lib/env.ts (the single process.env reader).
import { env } from "~/lib/env";

const PROVIDER_BASE_URL = env.OPENAI_COMPATIBLE_BASE_URL ?? "http://localhost:8317/v1";
const PROVIDER_API_KEY = env.OPENAI_COMPATIBLE_API_KEY ?? "ollama";

export const DEFAULT_CHAT_MODEL =
  env.CHEZY_MODEL_ID ?? "deepseek-ai/DeepSeek-V4.1-Flash";

export const titleModel: ChatModel = {
  description: "Fast model for title generation",
  id: env.CHEZY_TITLE_MODEL_ID ?? DEFAULT_CHAT_MODEL,
  name: "Default",
  provider: "bifrost",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

type BifrostModel = {
  id: string;
  name?: string;
  type?: string;
  tags?: string[];
};

async function fetchBifrostModels(): Promise<BifrostModel[]> {
  try {
    const res = await fetch(`${PROVIDER_BASE_URL}/models`, {
      headers: PROVIDER_API_KEY
        ? { Authorization: `Bearer ${PROVIDER_API_KEY}` }
        : {},
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: BifrostModel[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

/** Static fallback used if `/v1/models` is unreachable. */
const FALLBACK_MODELS: ChatModel[] = [
  {
    description: "Local bifrost default model",
    id: DEFAULT_CHAT_MODEL,
    name: "Default",
    provider: DEFAULT_CHAT_MODEL.split("/")[0],
  },
];

/**
 * Pull the live model list from bifrost. Cached for 60s so the chat UI
 * doesn't hammer the gateway. The first call after a fresh dev server
 * boot pays the ~100ms network cost; subsequent calls hit the Next.js
 * data cache.
 */
export async function getActiveModels(): Promise<ChatModel[]> {
  const raw = await fetchBifrostModels();
  if (raw.length === 0) return FALLBACK_MODELS;
  return raw.map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
    provider: m.id.split("/")[0],
    description: "",
  }));
}

// Synchronous access path used by `allowedModelIds`, `modelsByProvider`,
// and the model selector initial render. Reads the env var so the chat
// route's model-id check passes even before the async fetch resolves.
export const chatModels: ChatModel[] = FALLBACK_MODELS;
export const allowedModelIds = new Set(chatModels.map((m) => m.id));
export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);

export type ModelAvailability = "healthy" | "impacted" | "unknown";

export const isDemo = env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

/**
 * All chatModels with their capabilities. Defaults every model to
 * `tools: true, vision: false, reasoning: false` since bifrost's
 * `/v1/models` doesn't expose per-model capability metadata. The
 * model-selector UI uses these to decide which features to surface.
 */
export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  const models = await getActiveModels();
  return models.map((m) => ({
    ...m,
    capabilities: { reasoning: false, tools: true, vision: false },
  }));
}

/**
 * Per-model capability map. Bifrost doesn't expose supported_parameters
 * per model, so we default to a generous `tools: true, vision: false`
 * shape. Reasoning capability is opt-in (the upstream feature relied
 * on Vercel's gateway metadata that we don't have here).
 */
export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const models = await getActiveModels();
  return Object.fromEntries(
    models.map((m) => [
      m.id,
      { reasoning: false, tools: true, vision: false },
    ])
  );
}

export async function getModelAvailability(
  modelId: string
): Promise<ModelAvailability> {
  const models = await getActiveModels();
  if (!models.find((m) => m.id === modelId)) return "unknown";
  // Bifrost doesn't expose uptime/latency per model — everything is healthy.
  return "healthy";
}
