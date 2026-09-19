import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FETCH_TIMEOUT_MS } from "./constants";
import { ChatbotError } from "./errors";
import { fetcher, fetchWithErrorHandlers, safeHttpUrl } from "./utils";

// A fetch that never answers until its signal aborts, like a stalled gateway.
function stalledFetch(_input: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });
}

describe("fetch deadlines", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Node's global navigator has no onLine; browsers report true.
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("maps a stalled chat request to timeout:chat", () => {
    vi.stubGlobal("fetch", vi.fn(stalledFetch));

    const pending = fetchWithErrorHandlers("/api/chat", { method: "POST" });
    const assertion = expect(pending).rejects.toMatchObject({
      statusCode: 504,
      surface: "chat",
      type: "timeout",
    });
    return vi
      .advanceTimersByTimeAsync(FETCH_TIMEOUT_MS)
      .then(() => assertion)
      .then(() => expect(pending).rejects.toBeInstanceOf(ChatbotError));
  });

  it("maps a stalled SWR request to timeout:api", () => {
    vi.stubGlobal("fetch", vi.fn(stalledFetch));

    const pending = fetcher("/api/history");
    const assertion = expect(pending).rejects.toMatchObject({
      surface: "api",
      type: "timeout",
    });
    return vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS).then(() => assertion);
  });

  it("does not cut off a response whose headers already arrived", () => {
    const response = new Response("streaming");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    return fetchWithErrorHandlers("/api/chat")
      .then((result) => vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS * 2).then(() => result))
      .then((result) => {
        expect(result).toBe(response);
        expect(vi.getTimerCount()).toBe(0);
      });
  });

  it("still honours a caller supplied abort signal", () => {
    vi.stubGlobal("fetch", vi.fn(stalledFetch));
    const caller = new AbortController();

    const pending = fetchWithErrorHandlers("/api/chat", {
      signal: caller.signal,
    });
    const assertion = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    caller.abort();
    return assertion;
  });
});

describe("safeHttpUrl", () => {
  it("passes absolute http(s) URLs through", () => {
    expect(safeHttpUrl("https://www.idealista.com/inmueble/1/")).toBe(
      "https://www.idealista.com/inmueble/1/",
    );
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com");
  });

  it("rejects script, data and malformed URLs", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("data:text/html,<script>1</script>")).toBeUndefined();
    expect(safeHttpUrl("/relative/path")).toBeUndefined();
    expect(safeHttpUrl("")).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
});
