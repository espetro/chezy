import * as v from "valibot";

import type { Listing, SearchProfile } from "~/lib/db/schema";

export const EvidenceKeySchema = v.picklist([
  "price_eur",
  "rooms",
  "built_m2",
  "amenity:elevator",
  "amenity:balcony",
  "amenity:terrace",
  "amenity:heating",
  "amenity:air_conditioning",
  "insight.light_natural",
  "insight.condition",
]);

const ClaimSchema = v.object({
  key: EvidenceKeySchema,
  listingId: v.string(),
  text: v.string(),
  kind: v.picklist(["positive", "tradeoff", "unknown"]),
  source: v.picklist(["listing", "photo_estimate", "missing"]),
});

export const ExplanationMetaSchema = v.object({
  provider: v.picklist(["nebius", "openai-compatible"]),
  endpointHost: v.string(),
  requestedModel: v.string(),
  model: v.optional(v.string()),
  latencyMs: v.optional(v.number()),
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
});

export const GroundedExplanationSchema = v.object({
  listingId: v.string(),
  status: v.picklist(["live", "fallback"]),
  reason: v.optional(
    v.picklist([
      "pending",
      "request_failed",
      "not_configured",
      "insufficient_facts",
      "provider_failed",
      "invalid_evidence",
    ]),
  ),
  positives: v.pipe(v.array(ClaimSchema), v.maxLength(2)),
  tradeoff: ClaimSchema,
  meta: v.optional(ExplanationMetaSchema),
});

export type GroundedExplanation = v.InferOutput<typeof GroundedExplanationSchema>;
export type ExplanationClaim = v.InferOutput<typeof ClaimSchema>;
export type ExplanationMeta = v.InferOutput<typeof ExplanationMetaSchema>;
export type ExplanationSource = Pick<
  Listing,
  "id" | "priceEur" | "pricePeriod" | "rooms" | "builtM2" | "amenities"
>;
export type ExplanationPreferences = Pick<SearchProfile, "maxPriceEur" | "minRooms" | "minM2">;

const finitePositive = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0;

const PhotoFactsSchema = v.object({
  light: v.optional(v.object({ natural: v.picklist(["low", "medium", "high"]) })),
  condition: v.optional(
    v.object({
      score_1to5: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)),
      needs_renovation: v.boolean(),
    }),
  ),
});

export function buildExplanationFacts(
  row: ExplanationSource,
  preferences?: ExplanationPreferences,
  storedInsights?: unknown,
): ExplanationClaim[] {
  const facts: ExplanationClaim[] = [];
  const add = (
    key: ExplanationClaim["key"],
    text: string,
    kind: ExplanationClaim["kind"] = "positive",
    source: ExplanationClaim["source"] = "listing",
  ) => facts.push({ key, listingId: row.id, text, kind, source });

  if (finitePositive(row.priceEur)) {
    const monthly = row.pricePeriod === "month";
    const overBudget = monthly && preferences && row.priceEur > preferences.maxPriceEur;
    const withinBudget = monthly && preferences && row.priceEur <= preferences.maxPriceEur;
    add(
      "price_eur",
      `Listed price: €${row.priceEur}${monthly ? "/month" : " (period unknown)"}.${withinBudget ? " Within your maximum budget." : overBudget ? " Above your maximum budget." : ""}`,
      overBudget ? "tradeoff" : "positive",
    );
  } else {
    add("price_eur", "Listed price: unknown.", "unknown", "missing");
  }

  for (const [key, value, label, minimum] of [
    ["rooms", row.rooms, "Listed rooms", preferences?.minRooms],
    ["built_m2", row.builtM2, "Listed area (m²)", preferences?.minM2],
  ] as const) {
    if (finitePositive(value)) {
      const below = minimum !== undefined && value < minimum;
      add(
        key,
        `${label}: ${value}.${below ? " Below your requested minimum." : ""}`,
        below ? "tradeoff" : "positive",
      );
    } else {
      add(key, `${label}: unknown.`, "unknown", "missing");
    }
  }

  for (const amenity of [
    "elevator",
    "balcony",
    "terrace",
    "heating",
    "air_conditioning",
  ] as const) {
    if (row.amenities.includes(amenity)) {
      add(`amenity:${amenity}`, `Listing includes ${amenity.replaceAll("_", " ")}.`);
    }
  }

  const parsed = v.safeParse(PhotoFactsSchema, storedInsights);
  const photos = parsed.success ? parsed.output : undefined;
  if (photos?.condition) {
    const { score_1to5: score, needs_renovation: renovation } = photos.condition;
    add(
      "insight.condition",
      `Condition: ${score}/5, estimated from photos.${renovation ? " Renovation may be needed." : ""}`,
      score >= 4 && !renovation ? "positive" : "tradeoff",
      "photo_estimate",
    );
  } else {
    add(
      "insight.condition",
      "Condition: unknown (no usable stored photo analysis).",
      "unknown",
      "missing",
    );
  }
  if (photos?.light) {
    add(
      "insight.light_natural",
      `Natural light: ${photos.light.natural}, estimated from photos. Actual sunlight is unknown.`,
      "tradeoff",
      "photo_estimate",
    );
  } else {
    add(
      "insight.light_natural",
      "Natural light: unknown (no usable stored photo analysis).",
      "unknown",
      "missing",
    );
  }
  return facts;
}

export function deterministicExplanation(
  listingId: string,
  facts: ExplanationClaim[],
  reason: GroundedExplanation["reason"] = "pending",
): GroundedExplanation {
  const tradeoff =
    facts.find((fact) => fact.kind === "tradeoff") ??
    facts.find((fact) => fact.key === "insight.light_natural");
  if (!tradeoff || facts.some((fact) => fact.listingId !== listingId)) {
    throw new Error("Invalid explanation fact table");
  }
  return {
    listingId,
    status: "fallback",
    reason,
    positives: facts.filter((fact) => fact.kind === "positive").slice(0, 2),
    tradeoff,
  };
}

const SelectionSchema = v.strictObject({
  listingId: v.string(),
  positives: v.strictTuple([EvidenceKeySchema, EvidenceKeySchema]),
  tradeoff: EvidenceKeySchema,
});

export function validateExplanationSelection(
  selection: unknown,
  listingId: string,
  facts: ExplanationClaim[],
): Pick<GroundedExplanation, "positives" | "tradeoff"> | undefined {
  const parsed = v.safeParse(SelectionSchema, selection);
  if (!parsed.success || parsed.output.listingId !== listingId) return undefined;
  const { positives: keys, tradeoff: tradeoffKey } = parsed.output;
  if (new Set([...keys, tradeoffKey]).size !== 3) return undefined;
  const positives = keys.flatMap((key) =>
    facts.filter(
      (fact) => fact.key === key && fact.kind === "positive" && fact.listingId === listingId,
    ),
  );
  const tradeoff = facts.find(
    (fact) => fact.key === tradeoffKey && fact.kind !== "positive" && fact.listingId === listingId,
  );
  return positives.length === 2 && tradeoff ? { positives, tradeoff } : undefined;
}
