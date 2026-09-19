import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { env } from "~/lib/env";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

/**
 * chezy: replaced upstream's `gateway` (Vercel AI Gateway) with
 * `@ai-sdk/openai-compatible` so we can point at any OpenAI-shaped endpoint.
 * Default points at our local bifrost gateway at http://localhost:8317/v1.
 *
 * Env vars are read through lib/env.ts (the single process.env reader).
 */
const baseURL = env.OPENAI_COMPATIBLE_BASE_URL ?? "http://localhost:8317/v1";
const apiKey = env.OPENAI_COMPATIBLE_API_KEY ?? "ollama";

const openaiCompatibleProvider = createOpenAICompatible({
  apiKey,
  baseURL,
  name: "chezy",
});

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel: mockTitleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": mockTitleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  return openaiCompatibleProvider.chatModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return openaiCompatibleProvider.chatModel(titleModel.id);
}
