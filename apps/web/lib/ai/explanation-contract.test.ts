import { describe, expect, it } from "vitest";
import * as v from "valibot";

import {
  GroundedExplanationSchema,
  buildExplanationFacts,
  deterministicExplanation,
  validateExplanationSelection,
} from "~/lib/ai/explanation-contract";
import explanationFixtures from "~/lib/ai/explanation-fixtures.json";

const row = explanationFixtures[0]!;
const preferences = { maxPriceEur: 1200, minRooms: 2, minM2: 60 };
const facts = buildExplanationFacts(row, preferences);
const selection = {
  listingId: row.id,
  positives: ["price_eur", "rooms"],
  tradeoff: "insight.light_natural",
};

describe("grounded evidence selection", () => {
  it("renders numbers from source data and missing photo facts as unknown", () => {
    const result = validateExplanationSelection(selection, row.id, facts);
    expect(result?.positives.map((fact) => fact.text)).toEqual([
      "Listed price: €1000/month. Within your maximum budget.",
      "Listed rooms: 2.",
    ]);
    expect(result?.tradeoff).toMatchObject({ kind: "unknown", source: "missing" });
    expect(result?.tradeoff.text).toContain("unknown");
  });

  it.each([
    { ...selection, listingId: "other-listing" },
    { ...selection, positives: ["price_eur", "price_eur"] },
    { ...selection, positives: ["price_eur", "rooms", "pets_allowed"] },
    { ...selection, positives: ["price_eur", "pets_allowed"] },
    { ...selection, positives: ["price_eur", "agency_availability"] },
    { ...selection, positives: ["price_eur", "amenity:terrace"] },
    { ...selection, positives: ["price_eur", "insight.condition"] },
    { ...selection, tradeoff: "rooms" },
    { ...selection, text: "Guaranteed sunlight and mortgage approval" },
  ])("rejects unsupported selection %j", (invalid) => {
    expect(validateExplanationSelection(invalid, row.id, facts)).toBeUndefined();
  });

  it("rejects below-minimum facts as positives", () => {
    const expensive = buildExplanationFacts({ ...row, priceEur: 1800, rooms: 1 }, preferences);
    expect(validateExplanationSelection(selection, row.id, expensive)).toBeUndefined();
    expect(deterministicExplanation(row.id, expensive).tradeoff.text).toContain("Above");
  });

  it("labels stored light and condition as estimates without copying free text", () => {
    const photoFacts = buildExplanationFacts(row, preferences, {
      condition: { score_1to5: 4, needs_renovation: false },
      light: { natural: "high" },
      summary_es: "Guaranteed sun all day; pets allowed",
    });
    const result = validateExplanationSelection(
      {
        ...selection,
        positives: ["rooms", "insight.condition"],
      },
      row.id,
      photoFacts,
    );
    expect(result?.positives[1]?.text).toBe("Condition: 4/5, estimated from photos.");
    expect(result?.tradeoff.text).toBe(
      "Natural light: high, estimated from photos. Actual sunlight is unknown.",
    );
    expect(JSON.stringify(photoFacts)).not.toContain("pets");
  });

  it("does not turn malformed photo facts into schema defaults", () => {
    const invalid = buildExplanationFacts(row, preferences, { light: { natural: "guaranteed" } });
    expect(invalid.find((fact) => fact.key === "insight.light_natural")?.source).toBe("missing");
  });

  it("never invents two positives for an empty listing", () => {
    const empty = { ...row, priceEur: null, rooms: null, builtM2: null, amenities: [] };
    const result = deterministicExplanation(row.id, buildExplanationFacts(empty));
    expect(result.positives).toEqual([]);
    expect(result.tradeoff.kind).toBe("unknown");
  });

  it("does not infer a monthly price period", () => {
    const result = buildExplanationFacts({ ...row, pricePeriod: null }, preferences);
    expect(result[0]?.text).toBe("Listed price: €1000 (period unknown).");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "never emits unsupported numeric facts for %s",
    (value) => {
      const invalid = buildExplanationFacts({
        ...row,
        priceEur: value,
        rooms: value,
        builtM2: value,
      });
      expect(
        invalid
          .filter((fact) => ["price_eur", "rooms", "built_m2"].includes(fact.key))
          .every((fact) => fact.kind === "unknown" && fact.source === "missing"),
      ).toBe(true);
    },
  );
});

it("measures the same five deterministic fixtures with supported-claim denominators", () => {
  const expectedKeys = [
    ["price_eur", "rooms", "insight.light_natural"],
    ["rooms", "built_m2", "price_eur"],
    ["rooms", "built_m2", "insight.light_natural"],
    ["price_eur", "built_m2", "insight.light_natural"],
    ["price_eur", "amenity:elevator", "rooms"],
  ];
  const samples = explanationFixtures.map((fixture, index) => {
    const start = performance.now();
    const table = buildExplanationFacts(fixture, preferences);
    const result = deterministicExplanation(fixture.id, table, "not_configured");
    const latencyMs = performance.now() - start;
    expect(v.safeParse(GroundedExplanationSchema, result).success).toBe(true);
    const claims = [...result.positives, result.tradeoff];
    expect(claims.map((claim) => claim.key)).toEqual(expectedKeys[index]);
    expect(claims.every((claim) => claim.listingId === fixture.id)).toBe(true);
    return {
      listingId: fixture.id,
      latencyMs,
      supportedFactualClaims: claims.filter((claim) => claim.source !== "missing").length,
      displayedStatements: claims.length,
    };
  });
  console.info(
    JSON.stringify({
      measurement: "JES-7 deterministic fixture demo; not a statistical benchmark",
      sampleSize: samples.length,
      liveProviderRequests: 0,
      supportedFactualClaims: samples.reduce(
        (sum, sample) => sum + sample.supportedFactualClaims,
        0,
      ),
      displayedStatements: samples.reduce((sum, sample) => sum + sample.displayedStatements, 0),
      meanLatencyMs: samples.reduce((sum, sample) => sum + sample.latencyMs, 0) / samples.length,
      samples,
    }),
  );
});
