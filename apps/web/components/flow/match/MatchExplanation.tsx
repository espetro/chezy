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
    <section
      aria-label="Match explanation"
      aria-busy={isLoading}
      className="min-h-80 space-y-4 break-words text-graphite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-subheading font-semibold text-obsidian">Why this home</h2>
        <span className="text-[13px] text-fog">Match score: {matchScore}/100</span>
      </div>
      <p className="min-h-10 text-[13px] text-fog" role="status">
        {live
          ? `Evidence selected by ${explanation.meta?.provider ?? "provider"}; facts from stored data.`
          : isLoading
            ? "AI explanation pending. Showing deterministic reasons."
            : "AI explanation unavailable. Showing deterministic reasons."}
      </p>
      <ul className="space-y-3">
        {[0, 1].map((index) => {
          const claim = explanation.positives[index];
          return (
            <li key={index} className="min-h-28 rounded-2xl bg-paper p-3">
              {claim ? (
                <>
                  <p className="text-sm font-medium">{claim.text}</p>
                  <small className="text-fog">
                    Evidence: {claim.listingId} · {claim.key}
                  </small>
                </>
              ) : (
                <p className="text-sm text-fog">
                  No additional supported positive in the known facts.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="min-h-36 rounded-2xl bg-card-subtle p-4">
        <h3 className="mb-2 text-sm font-semibold text-obsidian">What to check</h3>
        <p className="text-sm">{explanation.tradeoff.text}</p>
        <small className="text-fog">
          Evidence: {explanation.tradeoff.listingId} · {explanation.tradeoff.key}
          {explanation.tradeoff.source === "missing" ? " (missing)" : ""}
        </small>
      </div>
      <div className="min-h-12">
        {explanation.meta?.latencyMs !== undefined && (
          <p className="text-xs text-fog">
            {explanation.meta.provider} ·{" "}
            {explanation.meta.model ?? explanation.meta.requestedModel}
            {" · "}
            {explanation.meta.latencyMs} ms
            {explanation.meta.inputTokens !== undefined &&
              ` · ${explanation.meta.inputTokens} input tokens`}
            {explanation.meta.outputTokens !== undefined &&
              ` · ${explanation.meta.outputTokens} output tokens`}
          </p>
        )}
      </div>
    </section>
  );
}
