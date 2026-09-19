import { beforeEach, expect, it, vi } from "vitest";

import { buildExplanationFacts, deterministicExplanation } from "~/lib/ai/explanation-contract";
import explanationFixtures from "~/lib/ai/explanation-fixtures.json";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), explainMatch: vi.fn(), getProfile: vi.fn() }));
vi.mock("~/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/ai/explain", () => ({ explainMatch: mocks.explainMatch }));
vi.mock("~/lib/profile", () => ({ getProfile: mocks.getProfile }));
import { POST } from "./route";

const request = (body: string) =>
  new Request("https://example.com/api/explain", { method: "POST", body });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  mocks.getProfile.mockResolvedValue(undefined);
  const row = explanationFixtures[0]!;
  mocks.explainMatch.mockResolvedValue(
    deterministicExplanation(row.id, buildExplanationFacts(row)),
  );
});

it("requires authentication before loading data", async () => {
  mocks.auth.mockResolvedValue(undefined);
  expect((await POST(request('{"listingId":"fixture-1"}'))).status).toBe(401);
  expect(mocks.explainMatch).not.toHaveBeenCalled();
});

it.each([
  "{",
  "{}",
  '{"listingId":7}',
  '{"listingId":"fixture-1","profile":{"maxPriceEur":999999}}',
])("rejects invalid bodies or client-supplied profile: %s", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.explainMatch).not.toHaveBeenCalled();
});

it("returns 404 for unknown listings", async () => {
  mocks.explainMatch.mockResolvedValue(undefined);
  expect((await POST(request('{"listingId":"missing"}'))).status).toBe(404);
});

it("returns validated private responses using the authenticated profile", async () => {
  const response = await POST(request('{"listingId":"fixture-1"}'));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.getProfile).toHaveBeenCalledWith("user-1");
  expect(await response.json()).toMatchObject({ status: "fallback", listingId: "fixture-1" });
});

it("hides database errors so the panel can retain deterministic facts", async () => {
  mocks.explainMatch.mockRejectedValue(new Error("private database detail"));
  const response = await POST(request('{"listingId":"fixture-1"}'));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "explanation unavailable" });
});
