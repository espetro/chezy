import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockQueryFn } = vi.hoisted(() => {
  const mockQueryFn = vi.fn();
  return { mockQueryFn };
});

vi.mock("postgres", () => ({
  default: vi.fn(() => mockQueryFn),
}));

import { findSimilarMemory, insertMemory, searchMemories } from "./memory-queries";

describe("memory-queries", () => {
  beforeEach(() => {
    mockQueryFn.mockReset();
  });

  function mockQueryResult(rows: unknown[]) {
    mockQueryFn.mockImplementationOnce((_strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = { sql: "", params: values };
      return Object.assign(query, {
        then: (resolve: (rows: unknown[]) => void, reject: (error: unknown) => void) =>
          Promise.resolve(rows).then(resolve, reject),
      });
    });
  }

  describe("insertMemory", () => {
    it("serializes embedding array to pgvector literal and passes params", async () => {
      mockQueryResult([]);

      await insertMemory({
        userId: "user-1",
        chatId: "chat-1",
        kind: "fact",
        content: "likes modernist architecture",
        embedding: [0.1, 0.2, 0.3],
        embeddingModel: "test-model",
      });

      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      const query = mockQueryFn.mock.calls[0] as unknown as [unknown, ...unknown[]];
      expect((query[0] as string[]).join("?")).toContain("::vector");
      expect(query.slice(1)).toEqual([
        "user-1",
        "chat-1",
        "fact",
        "likes modernist architecture",
        "[0.1,0.2,0.3]",
        "test-model",
      ]);
    });
  });

  describe("searchMemories", () => {
    it("orders params correctly and coerces distance to number", async () => {
      mockQueryResult([
        {
          id: "m1",
          userId: "user-1",
          chatId: "chat-1",
          kind: "summary",
          content: "summary text",
          embeddingModel: "test-model",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          distance: "0.123456789",
        },
      ]);

      const rows = await searchMemories({
        userId: "user-1",
        queryEmbedding: [1, 2, 3],
        limit: 5,
      });

      const query = mockQueryFn.mock.calls[0] as unknown as [unknown, ...unknown[]];
      expect(query.slice(1)).toEqual(["[1,2,3]", "user-1", "[1,2,3]", 5]);
      expect(rows).toHaveLength(1);
      expect(rows[0].distance).toBe(0.123456789);
      expect(typeof rows[0].distance).toBe("number");
    });
  });

  describe("findSimilarMemory", () => {
    it("returns undefined when no row is found", async () => {
      mockQueryResult([]);

      const row = await findSimilarMemory({
        userId: "user-1",
        contentEmbedding: [4, 5, 6],
        threshold: 0.5,
      });

      expect(row).toBeUndefined();
      const query = mockQueryFn.mock.calls[0] as unknown as [unknown, ...unknown[]];
      expect(query.slice(1)).toEqual(["[4,5,6]", "user-1", "[4,5,6]", 0.5]);
    });
  });
});
