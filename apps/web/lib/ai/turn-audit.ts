// Per-turn audit summary shared by the web chat route and the Telegram bot's
// Mastra observability exporter. Deliberately carries no message bodies or
// prompts — only counts, tool names, and listing ids.
import type { UIMessage } from "ai";

export interface TurnAudit {
  channel: "web" | "telegram";
  model: string;
  latency_ms: number;
  tools: Array<{ name: string; ok: boolean; listingIds?: string[] }>;
  cited_listing_ids: string[];
  grounding?: { score: number; ungrounded: string[] };
}

// Listing.id is `<platform>:<numericId>` (e.g. `idealista:110246870`). The
// assistant may cite the full idealista URL instead of the bare id, so urls
// are normalised to the id form.
const IDEALISTA_URL_RE = /idealista\.[a-z.]+\/inmueble\/(\d+)/gi;
const LISTING_ID_RE = /\b(idealista|fotocasa|habitaclia|milanuncios):(\d+)\b/g;

export function extractListingRefs(text: string): string[] {
  const refs = new Set<string>();
  for (const match of text.matchAll(IDEALISTA_URL_RE)) {
    refs.add(`idealista:${match[1]}`);
  }
  for (const match of text.matchAll(LISTING_ID_RE)) {
    refs.add(`${match[1]}:${match[2]}`);
  }
  return [...refs].sort();
}

// Pulls listing ids out of a tool's result payload. Unknown tools and
// non-conforming results return [] — never throw.
export function listingIdsFromToolResult(toolName: string, result: unknown): string[] {
  if (result === null || typeof result !== "object") {
    return [];
  }
  const record = result as Record<string, unknown>;
  if (toolName === "searchListings" && Array.isArray(record.listings)) {
    return record.listings.flatMap((l) =>
      l && typeof l === "object" && typeof (l as { id?: unknown }).id === "string"
        ? [(l as { id: string }).id]
        : [],
    );
  }
  if (
    (toolName === "getListing" || toolName === "getListingInsights") &&
    typeof record.id === "string"
  ) {
    return [record.id];
  }
  if (toolName === "arrangeViewing") {
    const listing = record.listing;
    if (listing && typeof listing === "object") {
      const id = (listing as { id?: unknown }).id;
      if (typeof id === "string") {
        return [id];
      }
    }
    // Web result: { listing, viewing, booking, viewingId }; the ViewingResult
    // union itself carries no id, so callers also pass the tool input
    // ({ listingId } web, { propertyRef } bot).
    for (const key of ["listingId", "propertyRef"] as const) {
      if (typeof record[key] === "string") {
        return [record[key]];
      }
    }
  }
  return [];
}

// Derives the toolCalls/assistantText inputs for `summarizeTurn` from the
// finished UI messages of a streamed web turn. Only terminal tool parts
// (`output-available` / `output-error`) are counted; the text seen by the
// caller is what we scan for cited listing ids.
export function turnFromUIMessages(messages: UIMessage[]): {
  toolCalls: Array<{ name: string; ok: boolean; result?: unknown; input?: unknown }>;
  assistantText: string;
} {
  const toolCalls = messages.flatMap((m) =>
    (m.parts ?? [])
      .filter(
        (p) =>
          (p.type.startsWith("tool-") || p.type === "dynamic-tool") &&
          "state" in p &&
          ((p as { state: string }).state === "output-available" ||
            (p as { state: string }).state === "output-error"),
      )
      .map((p) => {
        const part = p as {
          type: string;
          state: string;
          toolName?: string;
          output?: unknown;
          input?: unknown;
        };
        return {
          name:
            part.type === "dynamic-tool"
              ? (part.toolName ?? "unknown")
              : part.type.slice("tool-".length),
          ok: part.state === "output-available",
          result: part.output,
          input: part.input,
        };
      }),
  );
  const assistantText = messages
    .filter((m) => m.role === "assistant")
    .flatMap((m) =>
      (m.parts ?? [])
        .filter((p) => p.type === "text")
        .map((p) => (p as { text?: string }).text ?? ""),
    )
    .join("\n");
  return { toolCalls, assistantText };
}

export function summarizeTurn(input: {
  channel: TurnAudit["channel"];
  model: string;
  startedAt: number;
  toolCalls: Array<{ name: string; ok: boolean; result?: unknown; input?: unknown }>;
  assistantText: string;
}): TurnAudit {
  const tools = input.toolCalls.map((call) => {
    // Listing ids can live in the result (searchListings, getListing) or only
    // in the input (arrangeViewing's ViewingResult carries no id back).
    const listingIds = [
      ...new Set([
        ...listingIdsFromToolResult(call.name, call.result),
        ...listingIdsFromToolResult(call.name, call.input),
      ]),
    ].sort();
    return listingIds.length > 0
      ? { name: call.name, ok: call.ok, listingIds }
      : { name: call.name, ok: call.ok };
  });
  return {
    channel: input.channel,
    model: input.model,
    latency_ms: Math.max(0, Date.now() - input.startedAt),
    tools,
    cited_listing_ids: extractListingRefs(input.assistantText),
  };
}
