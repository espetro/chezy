import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { DEFAULT_PROVIDER_BASE_URL, isTestEnvironment } from "../constants";
import { env } from "../env";
import { titleModel } from "./models";

/**
 * chezy: replaced upstream's `gateway` (Vercel AI Gateway) with
 * `@ai-sdk/openai-compatible` so we can point at any OpenAI-shaped endpoint.
 * Defaults to the local bifrost gateway (DEFAULT_PROVIDER_BASE_URL); config
 * comes from the parsed env (lib/env.ts):
 *   OPENAI_COMPATIBLE_BASE_URL  e.g. https://api.studio.nebius.com/v1
 *   OPENAI_COMPATIBLE_API_KEY   provider key
 */
const baseURL = env.OPENAI_COMPATIBLE_BASE_URL ?? DEFAULT_PROVIDER_BASE_URL;
const apiKey = env.OPENAI_COMPATIBLE_API_KEY ?? "ollama";

const openaiCompatibleProvider = createOpenAICompatible({
  apiKey,
  baseURL,
  name: "chezy",
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        chatModel,
        titleModel: mockTitleModel,
      } = require("./models.mock");
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
