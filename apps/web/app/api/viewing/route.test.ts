import { randomUUID } from "node:crypto";
import { ViewingResultSchema } from "@chezy/contract";
import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CallDispatchError } from "~/lib/viewing-dispatch";

const mockEnv = vi.hoisted(() => ({
  VIEWING_MODE: "mock" as "mock" | "slng" | "vonage",
  VIEWING_LIVE_ENABLED: "false",
  DEMO_AGENCY_PHONE: undefined as string | undefined,
  SLNG_API_KEY: "test-key",
  SLNG_AGENT_ID: "test-agent",
  VONAGE_APPLICATION_ID: "test-app",
  VONAGE_FROM_NUMBER: "123456789",
  VONAGE_PRIVATE_KEY: "test-key",
}));

vi.mock("~/lib/env", () => ({ env: mockEnv }));
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  slng: vi.fn(),
  vonage: vi.fn(),
}));
vi.mock("~/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/slng", () => ({ dispatchSlngCall: mocks.slng }));
vi.mock("~/lib/vonage", () => ({ placeVonageCall: mocks.vonage }));
vi.mock("~/lib/listings", () => ({
  getListingById: vi.fn().mockResolvedValue(undefined),
  listingToCallVariables: vi.fn(),
}));
vi.mock("~/lib/insights", () => ({
  getListingInsights: vi.fn().mockResolvedValue(undefined),
  insightsToCallVariables: vi.fn(),
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/viewing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/viewing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.VIEWING_MODE = "mock";
    mockEnv.VIEWING_LIVE_ENABLED = "false";
    mockEnv.DEMO_AGENCY_PHONE = undefined;
    mockEnv.SLNG_API_KEY = "test-key";
    mocks.auth.mockResolvedValue({ user: { id: "test-user" } });
    mocks.slng.mockResolvedValue({ callId: "private-provider-call-id", detail: "private message" });
    mocks.vonage.mockResolvedValue({ uuid: "private-vonage-call-id", status: "started" });
  });

  function enableLive(channel: "slng" | "vonage" = "slng") {
    mockEnv.VIEWING_MODE = channel;
    mockEnv.VIEWING_LIVE_ENABLED = "true";
    mockEnv.DEMO_AGENCY_PHONE = "+34600000000";
    return { propertyRef: "fotocasa:1", live: true, requestId: randomUUID() };
  }

  it("simulates without phone numbers or credentials", async () => {
    const res = await post({ propertyRef: "fotocasa:1" });
    const result = v.parse(ViewingResultSchema, await res.json());
    expect(res.status).toBe(200);
    expect(result.status).toBe("mock");
    expect(mocks.slng).not.toHaveBeenCalled();
    expect(mocks.vonage).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("keeps automatic/rehearsal requests simulated even with live configuration", async () => {
    enableLive();
    const res = await post({ propertyRef: "fotocasa:1" });
    expect(await res.json()).toMatchObject({ status: "mock", channel: "mock" });
    expect(mocks.slng).not.toHaveBeenCalled();
  });

  it.each(["slng", "vonage"] as const)(
    "returns a validated %s dispatch with no slot, sanitized evidence and real elapsed time",
    async (channel) => {
      const input = enableLive(channel);
      const before = Date.now();
      const res = await post(input);
      const raw = await res.json();
      const result = v.parse(ViewingResultSchema, raw);
      expect(res.status).toBe(200);
      expect(result.status).toBe("dispatched");
      expect(result.channel).toBe(channel);
      expect(raw.slotIso).toBeUndefined();
      expect(JSON.stringify(raw)).not.toContain("private");
      expect(JSON.stringify(raw)).not.toContain(mockEnv.DEMO_AGENCY_PHONE);
      if (result.status === "dispatched") {
        expect(Date.parse(result.requestedAt)).toBeGreaterThanOrEqual(before);
        expect(Date.parse(result.dispatchedAt)).toBeLessThanOrEqual(Date.now());
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        expect(result.callId).toMatch(/^redacted:[a-f0-9]{12}$/);
      }
    },
  );

  it("blocks live mode without server opt-in", async () => {
    const input = enableLive();
    mockEnv.VIEWING_LIVE_ENABLED = "false";
    expect((await post(input)).status).toBe(403);
    expect(mocks.slng).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "123", "+000000000"])(
    "blocks invalid configured target %s",
    async (target) => {
      const input = enableLive();
      mockEnv.DEMO_AGENCY_PHONE = target;
      expect((await post(input)).status).toBe(400);
      expect(mocks.slng).not.toHaveBeenCalled();
    },
  );

  it("blocks caller-supplied agency targets", async () => {
    expect((await post({ ...enableLive(), agencyPhone: "+34999999999" })).status).toBe(400);
    expect(mocks.slng).not.toHaveBeenCalled();
  });

  it("requires auth, request IDs and configured credentials for live calls", async () => {
    const input = enableLive();
    expect((await post({ ...input, requestId: undefined })).status).toBe(400);
    mocks.auth.mockResolvedValue(undefined);
    expect((await post(input)).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { id: "test-user" } });
    mockEnv.SLNG_API_KEY = "";
    expect((await post(input)).status).toBe(503);
    expect(mocks.slng).not.toHaveBeenCalled();
  });

  it("replays concurrent and completed requests without duplicate dispatch", async () => {
    const input = enableLive();
    const [first, second] = await Promise.all([post(input), post(input)]);
    expect(await first.json()).toEqual(await second.json());
    expect((await post(input)).status).toBe(200);
    expect(mocks.slng).toHaveBeenCalledTimes(1);
  });

  it("rejects reuse of a request ID for a different property", async () => {
    const input = enableLive();
    await post(input);
    const res = await post({ ...input, propertyRef: "another-listing" });
    expect(await res.json()).toMatchObject({ status: "failed", retryable: false });
    expect(mocks.slng).toHaveBeenCalledTimes(1);
  });

  it("allows retry of a known rejection", async () => {
    const input = enableLive();
    mocks.slng.mockRejectedValueOnce(new CallDispatchError("private error", true));
    const failed = await post(input);
    expect(failed.status).toBe(502);
    expect(await failed.json()).toMatchObject({ status: "failed", retryable: true });
    expect((await post({ ...input, retry: true })).status).toBe(200);
    expect(mocks.slng).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent retries of a known rejection", async () => {
    const input = enableLive();
    mocks.slng.mockRejectedValueOnce(new CallDispatchError("rejected", true));
    await post(input);
    const retry = { ...input, retry: true };
    const responses = await Promise.all([post(retry), post(retry), post(retry)]);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(mocks.slng).toHaveBeenCalledTimes(2);
  });

  it("fails closed on retries without a receipt, including another worker or restart", async () => {
    const response = await post({ ...enableLive(), retry: true });
    expect(await response.json()).toMatchObject({ status: "failed", retryable: false });
    expect(mocks.slng).not.toHaveBeenCalled();
  });

  it("measures latency from route entry through provider acknowledgement", async () => {
    const clock = vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(275);
    try {
      const response = await post(enableLive());
      expect(await response.json()).toMatchObject({ latencyMs: 175 });
    } finally {
      clock.mockRestore();
    }
  });

  it.each(["timeout", "malformed"])(
    "retains uncertain %s outcome without redialling",
    async (failure) => {
      const input = enableLive();
      if (failure === "timeout") {
        mocks.slng.mockRejectedValueOnce(new Error("secret +34600000000"));
      } else {
        mocks.slng.mockResolvedValueOnce({ callId: "", detail: "provider accepted?" });
      }
      const first = await post(input);
      const body = await first.json();
      expect(body).toMatchObject({ status: "failed", retryable: false });
      expect(JSON.stringify(body)).not.toMatch(/secret|34600000000/);
      expect(await (await post(input)).json()).toEqual(body);
      expect(mocks.slng).toHaveBeenCalledTimes(1);
    },
  );

  it("returns validated failures for malformed request JSON and schema", async () => {
    const invalidJson = await POST(
      new Request("http://localhost/api/viewing", {
        method: "POST",
        body: "{",
      }),
    );
    expect(invalidJson.status).toBe(400);
    expect(v.parse(ViewingResultSchema, await invalidJson.json()).status).toBe("failed");
    expect((await post({})).status).toBe(400);
  });
});
