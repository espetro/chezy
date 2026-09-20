import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  enabled: vi.fn(),
  safe: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("~/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/demo/access", () => ({
  isDemoResetEnabled: mocks.enabled,
  isDemoRehearsalSafe: mocks.safe,
}));
vi.mock("~/lib/demo/reset", () => ({ resetDemo: mocks.reset }));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/demo/reset", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/demo/reset", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.enabled.mockReturnValue(true);
    mocks.safe.mockReturnValue(true);
    mocks.auth.mockResolvedValue({ user: { id: "current-guest" } });
    mocks.reset.mockResolvedValue({});
  });

  it("hides the endpoint outside development/demo without reading auth", async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await post({ loadPersona: true })).status).toBe(404);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated session", async () => {
    mocks.auth.mockResolvedValue(undefined);
    expect((await post({ loadPersona: true })).status).toBe(401);
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("refuses reset when live providers are configured", async () => {
    mocks.safe.mockReturnValue(false);
    expect((await post({ loadPersona: true })).status).toBe(409);
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests before any cleanup", async () => {
    expect((await post({ loadPersona: true }, { origin: "https://other.test" })).status).toBe(403);
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "resets only the authenticated identity (persona=%s)",
    async (loadPersona) => {
      const result = await post({ loadPersona }, { origin: "http://localhost" });
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({ reset: true });
      expect(mocks.reset).toHaveBeenCalledExactlyOnceWith("current-guest", loadPersona);
    },
  );

  it.each([{}, { loadPersona: "yes" }, { loadPersona: true, userId: "another-user" }])(
    "rejects malformed input and user targeting: %j",
    async (body) => {
      expect((await post(body)).status).toBe(400);
      expect(mocks.reset).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed JSON", async () => {
    const result = await POST(
      new Request("http://localhost/api/demo/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(result.status).toBe(400);
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("rejects simple form posts", async () => {
    expect((await post({ loadPersona: true }, { "content-type": "text/plain" })).status).toBe(415);
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("reports cleanup failure without leaking database details", async () => {
    mocks.reset.mockRejectedValue(new Error("private database details"));
    const result = await post({ loadPersona: true });
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain("private database details");
  });
});
