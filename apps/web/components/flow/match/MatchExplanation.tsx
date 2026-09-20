"use client";

import useSWR from "swr";
import * as v from "valibot";

import {
  GroundedExplanationSchema,
  buildExplanationFacts,
  deterministicExplanation,
  type ExplanationPreferences,
  type ExplanationSource,
} from "~/lib/ai/explanation-contract";

export interface MatchExplanationProps {
  listing: ExplanationSource;
  matchScore: number;
  preferences?: ExplanationPreferences;
  /** Include the signed-in user and profile revision to isolate cached results. */
  profileKey: string;
}

async function fetchExplanation([url, listingId]: readonly [string, string, string]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listingId }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Explanation unavailable");
  const explanation = v.parse(GroundedExplanationSchema, await response.json());
  if (explanation.listingId !== listingId) throw new Error("Mismatched listing");
  return explanation;
}

export function MatchExplanation({
  listing,
  matchScore,
  preferences,
  profileKey,
}: MatchExplanationProps) {
  const { data, error, isLoading } = useSWR(
    [`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/explain`, listing.id, profileKey] as const,
    fetchExplanation,
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
  );
  const explanation =
    data ??
    deterministicExplanation(
      listing.id,
      buildExplanationFacts(listing, preferences),
      error ? "request_failed" : "pending",
    );
  const live = explanation.status === "live";

  return (
    <section aria-label="Match explanation" aria-busy={isLoading} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{live ? "AI explanation" : "Deterministic reasons"}</h3>
        <span className="text-sm">Match score: {matchScore}/100</span>
      </div>
      <p className="text-sm text-muted-foreground" role="status">
        {live
          ? `Evidence selected by ${explanation.meta?.provider ?? "provider"}; facts from stored data.`
          : isLoading
            ? "AI explanation pending. Showing deterministic reasons."
            : "AI explanation unavailable. Showing deterministic reasons."}
      </p>
      <ul className="space-y-2">
        {explanation.positives.map((claim) => (
          <li key={claim.key}>
            <p>{claim.text}</p>
            <small className="text-muted-foreground">
              Evidence: {claim.listingId} · {claim.key}
            </small>
          </li>
        ))}
      </ul>
      {explanation.positives.length < 2 && (
        <p className="text-sm">Not enough known facts for two supported positives.</p>
      )}
      <div>
        <p>
          <strong>Trade-off / unknown: </strong>
          {explanation.tradeoff.text}
        </p>
        <small className="text-muted-foreground">
          Evidence: {explanation.tradeoff.listingId} · {explanation.tradeoff.key}
          {explanation.tradeoff.source === "missing" ? " (missing)" : ""}
        </small>
      </div>
      {explanation.meta?.latencyMs !== undefined && (
        <p className="text-xs text-muted-foreground">
          {explanation.meta.provider} · {explanation.meta.model ?? explanation.meta.requestedModel}
          {" · "}
          {explanation.meta.latencyMs} ms
          {explanation.meta.inputTokens !== undefined &&
            ` · ${explanation.meta.inputTokens} input tokens`}
          {explanation.meta.outputTokens !== undefined &&
            ` · ${explanation.meta.outputTokens} output tokens`}
        </p>
      )}
    </section>
  );
}
