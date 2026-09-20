import type { AdaptationFocus } from "@chezy/contract";
import { CAPABILITY_GAP_COVERAGE_THRESHOLD } from "~/lib/constants";
import type { CandidateFacts } from "~/lib/adaptation/types";
import { CAPABILITY_OUTDOOR_SPACE } from "~/lib/capability/prompt";

export interface CapabilityGap {
  capability: string;
  coverage: number;
  covered: number;
  total: number;
}

const hasFocusEvidence = (
  focus: AdaptationFocus,
  candidate: CandidateFacts,
): boolean | undefined =>
  // This capability measures the populated outdoorSpace column; amenity text is only a proxy.
  focus === "missing_balcony" ? candidate.outdoorSpace !== null : undefined;

export const detectCapabilityGap = (
  focus: AdaptationFocus,
  candidates: readonly CandidateFacts[],
): CapabilityGap | undefined => {
  if (candidates.length === 0) return undefined;
  const evidence = candidates.map((candidate) => hasFocusEvidence(focus, candidate));
  if (evidence.some((value) => value === undefined)) return undefined;
  const covered = evidence.filter((value) => value === true).length;
  const coverage = covered / candidates.length;
  if (coverage >= CAPABILITY_GAP_COVERAGE_THRESHOLD) return undefined;
  return { capability: CAPABILITY_OUTDOOR_SPACE, coverage, covered, total: candidates.length };
};
