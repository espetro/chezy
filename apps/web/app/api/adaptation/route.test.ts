import { AdaptationOutputSchema } from "@chezy/contract";
import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), start: vi.fn() }));
vi.mock("~/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/adaptation/runner", () => ({
  startAdaptation: mocks.start,
  AdaptationError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
}));

const eventId = "550e8400-e29b-41d4-a716-446655440000";
const job = {
  jobId: "660e8400-e29b-41d4-a716-446655440000",
  feedbackEventId: eventId,
  status: "queued",
  provider: "mock",
  attempt: 0,
  run: 1,
  trace: [{ at: "2026-09-20T10:00:00.000Z", step: "triggered" }],
  sessionUrl: null,
  panel: null,
  error: null,
  updatedAt: "2026-09-20T10:00:00.000Z",
};
const request = (body: unknown, headers = {}) =>
  new Request("http://localhost/api/adaptation", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("/api/adaptation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "authenticated-guest" } });
    mocks.start.mockResolvedValue(job);
  });
  it("rejects missing authentication", async () => {
    mocks.auth.mockResolvedValue(undefined);
    expect((await POST(request({ eventId }))).status).toBe(401);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("returns 202 with a strict, leak-free job body", async () => {
    const response = await POST(request({ eventId }));
    expect(response.status).toBe(202);
    expect(mocks.start).toHaveBeenCalledExactlyOnceWith("authenticated-guest", eventId);
    const text = await response.text();
    const parsed = v.safeParse(AdaptationOutputSchema, JSON.parse(text));
    expect(parsed.success).toBe(true);
    for (const leak of ["candidate", "cog_", "provider_session_id", "source_listing"]) {
      expect(text).not.toContain(leak);
    }
  });
  it.each([{ eventId: "not-an-id" }, { eventId, userId: "spoofed" }, {}])(
    "rejects malformed input %j",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.start).not.toHaveBeenCalled();
    },
  );
  it("rejects cross-origin and simple form submissions", async () => {
    expect((await POST(request({ eventId }, { origin: "http://other.test" }))).status).toBe(403);
    expect((await POST(request({ eventId }, { "content-type": "text/plain" }))).status).toBe(415);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("does not expose internals", async () => {
    mocks.start.mockRejectedValue(new Error("private db details"));
    const response = await POST(request({ eventId }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private db details");
  });
});
