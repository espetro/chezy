import { AdaptationOutputSchema } from "@chezy/contract";
import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), advance: vi.fn() }));
vi.mock("~/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/adaptation/runner", () => ({
  advanceAdaptation: mocks.advance,
  AdaptationError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
}));

const jobId = "660e8400-e29b-41d4-a716-446655440000";
const job = {
  jobId,
  feedbackEventId: "550e8400-e29b-41d4-a716-446655440000",
  status: "running",
  provider: "mock",
  attempt: 0,
  sessionUrl: null,
  panel: null,
  error: null,
  updatedAt: "2026-09-20T10:00:00.000Z",
};
const get = (id = jobId) =>
  GET(new Request(`http://localhost/api/adaptation/${id}`), {
    params: Promise.resolve({ jobId: id }),
  });

describe("/api/adaptation/[jobId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "authenticated-guest" } });
    mocks.advance.mockResolvedValue(job);
  });
  it("rejects missing authentication", async () => {
    mocks.auth.mockResolvedValue(undefined);
    expect((await get()).status).toBe(401);
    expect(mocks.advance).not.toHaveBeenCalled();
  });
  it("404s a foreign or missing job and a malformed id", async () => {
    mocks.advance.mockResolvedValue(undefined);
    expect((await get()).status).toBe(404);
    expect(mocks.advance).toHaveBeenCalledExactlyOnceWith("authenticated-guest", jobId);
    expect((await get("not-a-uuid")).status).toBe(404);
  });
  it("returns a strict, leak-free job body with no-store", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const text = await response.text();
    const parsed = v.safeParse(AdaptationOutputSchema, JSON.parse(text));
    expect(parsed.success).toBe(true);
    for (const leak of ["candidate", "cog_", "provider_session_id", "source_listing"]) {
      expect(text).not.toContain(leak);
    }
  });
  it("does not expose internals", async () => {
    mocks.advance.mockRejectedValue(new Error("private db details"));
    const response = await get();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private db details");
  });
});
