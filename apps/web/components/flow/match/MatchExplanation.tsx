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

  const positives = [0, 1].map((index) => explanation.positives[index]);

  return (
    <section
      aria-label="Match explanation"
      aria-busy={isLoading}
      className="flex flex-col gap-4 break-words text-graphite"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-subheading font-semibold text-obsidian">Why this home</h2>
        <span className="text-[13px] text-fog">Match score: {matchScore}/100</span>
      </div>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {positives.map((claim, index) => (
          <li key={index} className="flex flex-col gap-1 rounded-[14px] bg-paper px-4 py-3">
            {claim ? (
              <>
                <p className="text-sm leading-snug font-medium text-obsidian">{claim.text}</p>
                <span className="text-xs text-fog">{claim.key}</span>
              </>
            ) : (
              <p className="text-sm leading-snug text-fog">
                No additional supported positive in the known facts.
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1 rounded-[14px] border border-mist px-4 py-3">
        <h3 className="text-xs font-semibold tracking-wide text-fog uppercase">What to check</h3>
        <p className="text-sm leading-snug text-obsidian">{explanation.tradeoff.text}</p>
        <span className="text-xs text-fog">
          {explanation.tradeoff.key}
          {explanation.tradeoff.source === "missing" ? " (missing)" : ""}
        </span>
      </div>
      <p className="text-xs text-fog" role="status">
        {live
          ? "Reasons grounded in stored listing facts."
          : isLoading
            ? "AI explanation pending. Showing deterministic reasons."
            : "AI explanation unavailable. Showing deterministic reasons."}
      </p>
    </section>
  );
}
