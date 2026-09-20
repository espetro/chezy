import { AdaptationOutputSchema } from "@chezy/contract";
import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  retry: vi.fn(),
  AdaptationError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
}));
vi.mock("~/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/adaptation/runner", () => ({
  retryAdaptation: mocks.retry,
  AdaptationError: mocks.AdaptationError,
}));

const jobId = "660e8400-e29b-41d4-a716-446655440000";
const job = {
  jobId,
  feedbackEventId: "550e8400-e29b-41d4-a716-446655440000",
  status: "queued",
  provider: "mock",
  attempt: 0,
  run: 2,
  trace: [
    { at: "2026-09-20T10:00:00.000Z", step: "triggered" },
    { at: "2026-09-20T10:01:00.000Z", step: "failed", message: "Timed out" },
    { at: "2026-09-20T10:02:00.000Z", step: "retried", run: 2 },
  ],
  sessionUrl: null,
  panel: null,
  error: null,
  updatedAt: "2026-09-20T10:02:00.000Z",
};
const post = (id = jobId, headers: Record<string, string> = {}) =>
  POST(new Request(`http://localhost/api/adaptation/${id}/retry`, { method: "POST", headers }), {
    params: Promise.resolve({ jobId: id }),
  });

describe("/api/adaptation/[jobId]/retry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "authenticated-guest" } });
    mocks.retry.mockResolvedValue(job);
  });
  it("rejects missing authentication", async () => {
    mocks.auth.mockResolvedValue(undefined);
    expect((await post()).status).toBe(401);
    expect(mocks.retry).not.toHaveBeenCalled();
  });
  it("rejects cross-origin submissions", async () => {
    expect((await post(jobId, { origin: "https://evil.example" })).status).toBe(403);
    expect(mocks.retry).not.toHaveBeenCalled();
  });
  it("404s a malformed id without touching the runner", async () => {
    expect((await post("not-a-uuid")).status).toBe(404);
    expect(mocks.retry).not.toHaveBeenCalled();
  });
  it("returns 202 with the requeued job", async () => {
    const response = await post();
    expect(response.status).toBe(202);
    expect(mocks.retry).toHaveBeenCalledExactlyOnceWith("authenticated-guest", jobId);
    const parsed = v.safeParse(AdaptationOutputSchema, await response.json());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.output.job.run).toBe(2);
  });
  it.each([
    [404, "Job not found"],
    [409, "Only a failed comparison can be retried"],
  ])("passes a %s AdaptationError through", async (status, message) => {
    mocks.retry.mockRejectedValue(new mocks.AdaptationError(message, status));
    const response = await post();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });
  it("does not expose internals", async () => {
    mocks.retry.mockRejectedValue(new Error("private db details"));
    const response = await post();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private db details");
  });
});
