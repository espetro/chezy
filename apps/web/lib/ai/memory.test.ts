import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ModelMessage } from "ai";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
  getTitleModel: vi.fn(() => ({ modelId: "mock-title-model" })),
}));

vi.mock("@/lib/ai/models", () => ({
  titleModel: { id: "mock-title-model", gatewayOrder: undefined },
}));

vi.mock("@/lib/constants", () => ({
  MEMORY_MAX_CONTENT_CHARS: 500,
  MEMORY_COSINE_DEDUP_THRESHOLD: 0.15,
}));

import { generateText } from "ai";
import { extractMemories, formatMemoryContext, isDuplicateMemory } from "./memory";

const generateTextMock = vi.mocked(generateText);

function mockModelText(text: string) {
  generateTextMock.mockResolvedValue({ text } as Awaited<ReturnType<typeof generateText>>);
}

const messages: ModelMessage[] = [
  { role: "user", content: "I'm looking for a 2BR in Lisbon under 400k" },
];

describe("extractMemories", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it("parses a plain JSON array", async () => {
    mockModelText(`["Wants a 2BR in Lisbon","Budget under 400k EUR"]`);
    const result = await extractMemories(messages);
    expect(result).toEqual(["Wants a 2BR in Lisbon", "Budget under 400k EUR"]);
  });

  it("is tolerant of code fences", async () => {
    mockModelText('```json\n["Prefers Lisbon"]\n```');
    const result = await extractMemories(messages);
    expect(result).toEqual(["Prefers Lisbon"]);
  });

  it("is tolerant of prose wrapping the array", async () => {
    mockModelText('Sure! Here are the memories:\n["Relocating to Porto"]\nHope that helps.');
    const result = await extractMemories(messages);
    expect(result).toEqual(["Relocating to Porto"]);
  });

  it("caps at 3 memories", async () => {
    mockModelText('["a","b","c","d","e"]');
    const result = await extractMemories(messages);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("slices each memory to MEMORY_MAX_CONTENT_CHARS", async () => {
    mockModelText(JSON.stringify(["x".repeat(900), "short"]));
    const result = await extractMemories(messages);
    expect(result[0]).toHaveLength(500);
    expect(result[1]).toBe("short");
  });

  it("filters non-string entries", async () => {
    mockModelText('[42, null, "keeps this", {"no": 1}]');
    const result = await extractMemories(messages);
    expect(result).toEqual(["keeps this"]);
  });

  it("returns [] on garbage output", async () => {
    mockModelText("I found no durable facts, sorry!");
    const result = await extractMemories(messages);
    expect(result).toEqual([]);
  });

  it("returns [] when the model call throws", async () => {
    generateTextMock.mockRejectedValue(new Error("boom"));
    const result = await extractMemories(messages);
    expect(result).toEqual([]);
  });
});

describe("formatMemoryContext", () => {
  it("returns empty string for no memories", () => {
    expect(formatMemoryContext([])).toBe("");
  });

  it("renders heading and bullet lines", () => {
    const out = formatMemoryContext([
      { content: "Prefers Lisbon", kind: "location" },
      { content: "Budget 400k", kind: "budget" },
    ]);
    expect(out).toContain("## Memory from previous sessions");
    expect(out).toContain("- [location] Prefers Lisbon");
    expect(out).toContain("- [budget] Budget 400k");
  });
});

describe("isDuplicateMemory", () => {
  it("is a duplicate when distance is below the threshold", () => {
    expect(isDuplicateMemory(0.05)).toBe(true);
  });

  it("is not a duplicate when distance meets or exceeds the threshold", () => {
    expect(isDuplicateMemory(0.15)).toBe(false);
    expect(isDuplicateMemory(0.9)).toBe(false);
  });

  it("is not a duplicate when distance is undefined", () => {
    expect(isDuplicateMemory(undefined)).toBe(false);
  });

  it("honors a custom threshold", () => {
    expect(isDuplicateMemory(0.4, 0.5)).toBe(true);
    expect(isDuplicateMemory(0.6, 0.5)).toBe(false);
  });
});
