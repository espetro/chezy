import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  VIEWING_MODE: "mock" as const,
  DEMO_AGENCY_PHONE: undefined as string | undefined,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

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
    mockEnv.VIEWING_MODE = "mock";
    mockEnv.DEMO_AGENCY_PHONE = undefined;
  });

  it("400s when neither agencyPhone nor DEMO_AGENCY_PHONE is set", async () => {
    const res = await post({ propertyRef: "fotocasa:1" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("no callee");
  });

  it("falls back to DEMO_AGENCY_PHONE and returns a mock result", async () => {
    mockEnv.DEMO_AGENCY_PHONE = "+34600000000";
    const res = await post({ propertyRef: "fotocasa:1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("mock");
    expect(body.channel).toBe("mock");
    expect(body.slotIso).toBeTruthy();
  });
});
