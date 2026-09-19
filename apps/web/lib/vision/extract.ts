import { readFile } from "node:fs/promises";
import path from "node:path";

import * as v from "valibot";

import { env } from "~/lib/env";

import { INSIGHTS_PROMPT_VERSION, LISTING_INSIGHTS_PROMPT } from "~/lib/vision/prompt";
import { type ListingInsights, ListingInsightsSchema } from "~/lib/vision/schema";

const MAX_PHOTOS = 25;
const MAX_TOKENS = 5000;

// lib/vision/extract.ts -> apps/web -> repo root (has chezy-mock-data/).
// import.meta.dirname is undefined under Turbopack; fall back to cwd (apps/web).
const REPO_ROOT = path.resolve(
  import.meta.dirname ?? path.join(process.cwd(), "lib", "vision"),
  "../../../..",
);

async function dataUrl(localPath: string): Promise<string | undefined> {
  try {
    // Dataset `local_path` already starts with `media/`.
    const buf = await readFile(path.join(REPO_ROOT, "chezy-mock-data", localPath));
    return `data:image/webp;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

type ImagePart = { type: "image_url"; image_url: { url: string } };

type TextPart = { type: "text"; text: string };

async function callModel(
  model: string,
  content: (TextPart | ImagePart)[],
): Promise<{ text: string; usage: { promptTokens: number; completionTokens: number } }> {
  const baseUrl = env.OPENAI_COMPATIBLE_BASE_URL;
  const apiKey = env.OPENAI_COMPATIBLE_API_KEY;
  if (!(baseUrl && apiKey)) {
    throw new Error(
      "OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_API_KEY are required for listing insights",
    );
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: MAX_TOKENS,
      // Kimi-K3 spends the whole budget on reasoning unless thinking is off.
      chat_template_kwargs: { thinking: false },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    throw new Error(`vision model request failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const message = json.choices?.[0]?.message?.content;
  return {
    text: typeof message === "string" ? message : "",
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
    },
  };
}

function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

export async function extractListingInsights(
  input: {
    listingId: string;
    photos: { url: string; localPath: string | undefined }[];
  },
  opts?: { modelId?: string },
): Promise<{
  insights: ListingInsights;
  model: string;
  promptVersion: number;
  usage: { promptTokens: number; completionTokens: number };
}> {
  const model = opts?.modelId ?? env.VISION_MODEL_ID;
  const photos = input.photos.slice(0, MAX_PHOTOS);
  const parts: (TextPart | ImagePart)[] = [{ type: "text", text: LISTING_INSIGHTS_PROMPT }];
  for (const photo of photos) {
    const local = photo.localPath ? await dataUrl(photo.localPath) : undefined;
    parts.push({ type: "image_url", image_url: { url: local ?? photo.url } });
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      parts[0] = {
        type: "text",
        text: `${LISTING_INSIGHTS_PROMPT}\nReturn only the JSON object, no prose.`,
      };
    }
    const { text, usage } = await callModel(model, parts);
    try {
      return {
        insights: v.parse(ListingInsightsSchema, JSON.parse(stripFences(text))),
        model,
        promptVersion: INSIGHTS_PROMPT_VERSION,
        usage,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
