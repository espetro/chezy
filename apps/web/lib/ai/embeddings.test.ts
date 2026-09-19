import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMBEDDING_MODEL_ID, embedText } from "./embeddings";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("embedText", () => {
  it("POSTs to /embeddings with model, auth and input, returning the embedding", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), {
        status: 200,
      }),
    );

    const result = await embedText("hello");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8317/v1/embeddings");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toMatch(/^Bearer /);
    expect(JSON.parse(init.body)).toEqual({
      model: EMBEDDING_MODEL_ID,
      input: "hello",
    });
  });

  it("throws with status and body snippet on non-OK responses", async () => {
    fetchMock.mockResolvedValue(new Response("model not found", { status: 404 }));

    await expect(embedText("x")).rejects.toThrow(/404.*model not found/s);
  });

  it("handles trailing-slash base URLs", async () => {
    process.env.OPENAI_COMPATIBLE_BASE_URL = "http://localhost:8317/v1/";
    vi.resetModules();
    const mod = await import("./embeddings");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: [1] }] }), {
        status: 200,
      }),
    );

    await mod.embedText("x");

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8317/v1/embeddings");
    delete process.env.OPENAI_COMPATIBLE_BASE_URL;
  });
});
