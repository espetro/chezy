import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { Mastra } from "@mastra/core/mastra";
import { Memory } from "@mastra/memory";
import { Observability } from "@mastra/observability";
import type { AuditLogger } from "@chezy/observability";
import { PostgresStore } from "@mastra/pg";
import type { TelegramProvider } from "@mastra/telegram";

import { DEFAULT_CHAT_MODEL_ID, DEFAULT_PROVIDER_BASE_URL } from "~/lib/constants";

import { env } from "./env";
import { CHEZY_INSTRUCTIONS } from "./instructions";
import { ChezyAuditExporter } from "./observability/audit-exporter";
import { createTelegramProvider } from "./telegram";
import { SESSION_CONTEXT_KEY, THREAD_CONTEXT_KEY, USERNAME_CONTEXT_KEY } from "./tools/adapt";
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

export function createBotStack(model?: MastraModelConfig, auditLogger?: AuditLogger): BotStack {
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
    observability: new Observability({
      configs: {
        default: {
          serviceName: "chezy-bot",
          requestContextKeys: [USERNAME_CONTEXT_KEY, SESSION_CONTEXT_KEY, THREAD_CONTEXT_KEY],
          exporters: [new ChezyAuditExporter(auditLogger)],
        },
      },
    }),
  });

  return { mastra, agent, telegram, storage };
}
