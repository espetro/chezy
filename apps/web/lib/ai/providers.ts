import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

/**
 * chezy: replaced upstream's `gateway` (Vercel AI Gateway) with
 * `@ai-sdk/openai-compatible` so we can point at any OpenAI-shaped endpoint.
 * Default points at our local bifrost gateway at http://localhost:8317/v1.
 *
 * Env vars (read directly here; the canonical lib/env.ts bridge is for
 * chezy-owned app code, this file is part of the verbatim upstream surface):
 *   OPENAI_COMPATIBLE_BASE_URL  e.g. http://localhost:8317/v1 (bifrost)
 *   OPENAI_COMPATIBLE_API_KEY   bifrost virtual key
 *   CHEZY_MODEL_ID              default model id (e.g. "deepseek-ai/DeepSeek-V4.1-Flash")
 */
const baseURL =
  process.env.OPENAI_COMPATIBLE_BASE_URL ?? "http://localhost:8317/v1";
const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY ?? "ollama";
const defaultModelId =
  process.env.CHEZY_MODEL_ID ?? "deepseek-ai/DeepSeek-V4.1-Flash";

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
