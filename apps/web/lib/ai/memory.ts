import { generateText, type ModelMessage } from "ai";
import { MEMORY_COSINE_DEDUP_THRESHOLD, MEMORY_MAX_CONTENT_CHARS } from "@/lib/constants";
import { titleModel } from "@/lib/ai/models";
import { getTitleModel } from "@/lib/ai/providers";

const MEMORY_EXTRACTION_MAX = 3;

const memoryExtractionPrompt = `You extract durable facts about the user from a conversation.

Return ONLY a JSON array of 0 to 3 short strings. Each string is one durable fact about the user: property interests, budget, locations, or decisions. Each string must be at most ${MEMORY_MAX_CONTENT_CHARS} characters.

Rules:
- Output ONLY the JSON array. No commentary, no code fences, no surrounding text.
- Omit facts that are transient (greetings, small talk, current weather) or already covered by another entry.
- If nothing durable is present, return [].`;

/**
 * Extracts up to 3 durable user facts from a conversation using the title
 * model. Mirrors generateTitleFromUserMessage's provider wiring. Tolerant of
 * model sloppiness: always returns at most 3 trimmed strings and never throws.
 */
export async function extractMemories(messages: ModelMessage[]): Promise<string[]> {
  try {
    const { text } = await generateText({
      instructions: memoryExtractionPrompt,
      model: getTitleModel(),
      prompt: JSON.stringify(messages),
      providerOptions: {
        ...(titleModel.gatewayOrder && {
          gateway: { order: titleModel.gatewayOrder },
        }),
      },
    });

    const parsed = parseMemoryArray(text);
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, MEMORY_EXTRACTION_MAX)
      .map((item) => item.slice(0, MEMORY_MAX_CONTENT_CHARS));
  } catch {
    return [];
  }
}

function parseMemoryArray(raw: string): unknown[] {
  try {
    let text = raw.trim();
    // Strip markdown code fences if the model wrapped the array.
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    const first = text.indexOf("[");
    const last = text.lastIndexOf("]");
    if (first === -1 || last === -1 || last <= first) {
      return [];
    }

    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return [];
  }
}

/**
 * Renders stored memories as a system-prompt appendix block. Empty string when
 * there is nothing to remember, so callers can append conditionally.
 */
export function formatMemoryContext(memories: { content: string; kind: string }[]): string {
  if (memories.length === 0) {
    return "";
  }

  const lines = memories.map((memory) => `- [${memory.kind}] ${memory.content}`);
  return `## Memory from previous sessions\n\n${lines.join("\n")}`;
}

/**
 * Vector-similarity dedup check: a candidate memory is a duplicate when its
 * cosine distance to an already-stored memory is below the threshold.
 * `undefined` distance (no neighbor found) means it is new.
 */
export function isDuplicateMemory(
  distance: number | undefined,
  threshold: number = MEMORY_COSINE_DEDUP_THRESHOLD,
): boolean {
  return distance !== undefined && distance < threshold;
}
