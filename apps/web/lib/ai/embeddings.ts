import { env } from "@/lib/env";

const baseUrl = (env.OPENAI_COMPATIBLE_BASE_URL ?? "http://localhost:8317/v1").replace(/\/+$/, "");

const apiKey = env.OPENAI_COMPATIBLE_API_KEY ?? "ollama";

export const EMBEDDING_MODEL_ID = env.CHEZY_EMBEDDING_MODEL_ID;
export const EMBEDDING_DIMS = 4096;

/**
 * Embed a single text via the OpenAI-compatible `/embeddings` endpoint.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL_ID, input: text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return (
    json.data[0]?.embedding ??
    (() => {
      throw new Error("Embedding response contained no embedding vector");
    })()
  );
}
