import { beforeEach, describe, expect, it, vi } from "vitest";

import explanationFixtures from "~/lib/ai/explanation-fixtures.json";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getListingRowById: vi.fn(),
  where: vi.fn(),
  audit: vi.fn(),
  env: {
    OPENAI_COMPATIBLE_API_KEY: "unit-test-only",
    OPENAI_COMPATIBLE_BASE_URL: "https://api.studio.nebius.com/v1",
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({ generateText: mocks.generateText }));
vi.mock("~/lib/listings", () => ({ getListingRowById: mocks.getListingRowById }));
vi.mock("~/lib/db/client", () => ({
  db: { select: () => ({ from: () => ({ where: mocks.where }) }) },
}));
vi.mock("~/lib/ai/providers", () => ({ getLanguageModel: () => "test-model" }));
vi.mock("~/lib/ai/models", () => ({ DEFAULT_CHAT_MODEL: "requested-model" }));
vi.mock("~/lib/constants", () => ({
  DEFAULT_PROVIDER_BASE_URL: "http://localhost:8317/v1",
  isTestEnvironment: false,
}));
vi.mock("~/lib/env", () => ({ env: mocks.env }));
vi.mock("@chezy/observability", () => ({ createAuditLogger: () => ({ emit: mocks.audit }) }));

import { explainMatch, explanationProviderMeta } from "~/lib/ai/explain";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.OPENAI_COMPATIBLE_API_KEY = "unit-test-only";
  mocks.env.OPENAI_COMPATIBLE_BASE_URL = "https://api.studio.nebius.com/v1";
  mocks.getListingRowById.mockResolvedValue(explanationFixtures[0]);
  mocks.where.mockResolvedValue([]);
  mocks.generateText.mockResolvedValue({
    text: JSON.stringify({
      listingId: "fixture-1",
      positives: ["rooms", "amenity:elevator"],
      tradeoff: "insight.light_natural",
    }),
    response: { modelId: "returned-model" },
    usage: { inputTokens: 120, outputTokens: 35 },
  });
});

describe("explainMatch", () => {
  it("lets a validated model selection change the visible reasons with actual metadata", async () => {
    const result = await explainMatch("fixture-1");
    expect(result?.status).toBe("live");
    expect(result?.positives.map((fact) => fact.key)).toEqual(["rooms", "amenity:elevator"]);
    expect(result?.meta).toMatchObject({
      provider: "nebius",
      model: "returned-model",
      requestedModel: "requested-model",
      inputTokens: 120,
      outputTokens: 35,
      latencyMs: expect.any(Number),
    });
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 0, abortSignal: expect.any(AbortSignal) }),
    );
    const logged = JSON.stringify(mocks.audit.mock.calls);
    expect(logged).not.toContain("unit-test-only");
    expect(logged).not.toContain("prompt");
  });

  it("returns unknown listing before any provider call", async () => {
    mocks.getListingRowById.mockResolvedValue(undefined);
    expect(await explainMatch("missing")).toBeUndefined();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("skips unconfigured providers without manufacturing latency or tokens", async () => {
    mocks.env.OPENAI_COMPATIBLE_API_KEY = "";
    const result = await explainMatch("fixture-1");
    expect(result).toMatchObject({ status: "fallback", reason: "not_configured" });
    expect(result?.meta?.latencyMs).toBeUndefined();
    expect(result?.meta?.inputTokens).toBeUndefined();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("retains fallback facts for malformed provider configuration", async () => {
    mocks.env.OPENAI_COMPATIBLE_BASE_URL = "invalid-url";
    expect(await explainMatch("fixture-1")).toMatchObject({
      status: "fallback",
      reason: "not_configured",
    });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("skips generation when fewer than two positive facts exist", async () => {
    mocks.getListingRowById.mockResolvedValue({
      ...explanationFixtures[0],
      priceEur: null,
      rooms: null,
      builtM2: null,
      amenities: [],
    });
    expect(await explainMatch("fixture-1")).toMatchObject({
      status: "fallback",
      reason: "insufficient_facts",
      positives: [],
    });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("falls back on provider failure without leaking exception content", async () => {
    mocks.generateText.mockRejectedValue(new Error("private-key-provider-error"));
    const result = await explainMatch("fixture-1");
    expect(result).toMatchObject({ status: "fallback", reason: "provider_failed" });
    expect(result?.meta?.inputTokens).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("private-key");
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("private-key");
  });

  it.each([
    "not JSON",
    '{"listingId":"fixture-1","positives":["rooms","pets_allowed"],"tradeoff":"insight.light_natural"}',
  ])("falls back on invalid provider output", async (text) => {
    mocks.generateText.mockResolvedValue({ text, response: { modelId: "test" }, usage: {} });
    const result = await explainMatch("fixture-1");
    expect(result).toMatchObject({ status: "fallback", reason: "invalid_evidence" });
    expect(result?.meta?.outputTokens).toBeUndefined();
  });
});

it.each([
  ["https://api.studio.nebius.com/v1", "nebius"],
  ["https://api.tokenfactory.nebius.com/v1", "nebius"],
  ["http://localhost:8317/v1", "openai-compatible"],
  ["https://api.studio.nebius.com.attacker.example/v1", "openai-compatible"],
  ["http://api.studio.nebius.com/v1", "openai-compatible"],
])("labels endpoint %s as %s", (url, provider) => {
  expect(explanationProviderMeta(url, "model")?.provider).toBe(provider);
});
