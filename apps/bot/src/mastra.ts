import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { Mastra } from "@mastra/core/mastra";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import type { TelegramProvider } from "@mastra/telegram";

import { DEFAULT_CHAT_MODEL_ID, DEFAULT_PROVIDER_BASE_URL } from "~/lib/constants";

import { env } from "./env";
import { CHEZY_INSTRUCTIONS } from "./instructions";
import { createTelegramProvider } from "./telegram";
import { chezyTools } from "./tools";

const WORKING_MEMORY_TEMPLATE = `# Housing profile
- **Budget (EUR/month)**:
- **Neighbourhoods**:
- **Bedrooms (min)**:
- **Must-haves**:
- **Red lines**:
- **Work location / commute**:
`;

export const DEFAULT_POSTGRES_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

export interface BotStack {
  mastra: Mastra;
  agent: Agent;
  telegram: TelegramProvider;
  storage: PostgresStore;
}

export function createBotStack(model?: MastraModelConfig): BotStack {
  const storage = new PostgresStore({
    id: "chezy-bot",
    connectionString: env.POSTGRES_URL ?? DEFAULT_POSTGRES_URL,
    schemaName: "mastra",
  });

  const memory = new Memory({
    storage,
    options: {
      lastMessages: 20,
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: WORKING_MEMORY_TEMPLATE,
      },
      semanticRecall: false,
    },
  });

  const agent = new Agent({
    id: "chezy",
    name: "chezy",
    instructions: CHEZY_INSTRUCTIONS,
    model:
      model ??
      ({
        id: `custom/${env.CHEZY_MODEL_ID ?? DEFAULT_CHAT_MODEL_ID}`,
        url: env.OPENAI_COMPATIBLE_BASE_URL ?? DEFAULT_PROVIDER_BASE_URL,
        apiKey: env.OPENAI_COMPATIBLE_API_KEY ?? "ollama",
      } satisfies MastraModelConfig),
    memory,
    tools: chezyTools,
  });

  const telegram = createTelegramProvider();
  const mastra = new Mastra({
    agents: { chezy: agent },
    channels: { telegram },
    storage,
  });

  return { mastra, agent, telegram, storage };
}
