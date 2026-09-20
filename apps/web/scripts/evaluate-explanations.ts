import { performance } from "node:perf_hooks";

import { buildExplanationFacts, deterministicExplanation } from "~/lib/ai/explanation-contract";
import fixtures from "~/lib/ai/explanation-fixtures.json";

const preferences = { maxPriceEur: 1200, minRooms: 2, minM2: 60 };
const samples = fixtures.map((listing) => {
  const started = performance.now();
  const facts = buildExplanationFacts(listing, preferences);
  const explanation = deterministicExplanation(listing.id, facts, "not_configured");
  const latencyMs = performance.now() - started;
  const claims = [...explanation.positives, explanation.tradeoff];
  const factual = claims.filter((claim) => claim.source !== "missing");
  return {
    listingId: listing.id,
    status: explanation.status,
    latencyMs,
    supportedFactualClaims: factual.filter((claim) =>
      facts.some(
        (fact) =>
          fact.listingId === claim.listingId && fact.key === claim.key && fact.text === claim.text,
      ),
    ).length,
    totalFactualClaims: factual.length,
    explicitUnknowns: claims.length - factual.length,
    explanation,
  };
});
const supported = samples.reduce((sum, sample) => sum + sample.supportedFactualClaims, 0);
const total = samples.reduce((sum, sample) => sum + sample.totalFactualClaims, 0);
console.log(
  JSON.stringify(
    {
      measurement: "Deterministic fixture demo measurement; not a statistical benchmark",
      measuredAt: new Date().toISOString(),
      sampleSize: samples.length,
      liveProviderRequests: 0,
      liveProviderProof: "not attempted: deterministic-only evaluation",
      supportedFactualClaims: supported,
      totalFactualClaims: total,
      supportedClaimCoverage: total === 0 ? undefined : supported / total,
      explicitUnknowns: samples.reduce((sum, sample) => sum + sample.explicitUnknowns, 0),
      meanLatencyMs: samples.reduce((sum, sample) => sum + sample.latencyMs, 0) / samples.length,
      samples,
    },
    undefined,
    2,
  ),
);
