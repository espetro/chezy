import { validateComparisonPanel, type ValidationContext } from "~/lib/adaptation/validate";
import type { AdaptationJobRow } from "~/lib/db/schema";
import type { DevinSessionSnapshot } from "~/lib/devin/client";

// The only strings ever written to the user-facing `error` column. Provider
// details (status codes, bodies, keys) never reach the row.
export const ADAPTATION_ERRORS = {
  notConfigured: "Devin is not configured",
  provider: "The comparison service is unavailable",
  quota: "Devin has no session quota right now. Your feed is unchanged.",
  unauthorized: "Devin rejected the API key. Your feed is unchanged.",
  noResult: "Devin session ended without a result",
  invalid: "The comparison did not match your listings",
  timeout: "Timed out",
} as const;

export type AdaptationStepInput =
  | { kind: "claim" }
  | { kind: "snapshot"; snapshot: DevinSessionSnapshot; ctx: ValidationContext }
  | { kind: "provider_error"; message: string }
  | { kind: "stale" }
  | { kind: "timeout" };

export type AdaptationEffect = { kind: "create_session" } | { kind: "none" };

export interface AdaptationStep {
  patch: Partial<AdaptationJobRow>;
  effect: AdaptationEffect;
}

const TERMINAL = new Set(["ready", "failed", "stale"]);
const unchanged: AdaptationStep = { patch: {}, effect: { kind: "none" } };

// Pure transition function. The "validating" status is transient inside one
// snapshot step (validate inline, then write ready/failed); it is never
// persisted. There are no correction retries yet:
// attempt is 1 from the claim onward and an invalid candidate fails the job.
export const nextStep = (job: AdaptationJobRow, input: AdaptationStepInput): AdaptationStep => {
  if (TERMINAL.has(job.status)) return unchanged;
  switch (input.kind) {
    case "stale":
      // Never writes accepted_spec; the panel is discarded.
      return { patch: { status: "stale" }, effect: { kind: "none" } };
    case "timeout":
      return {
        patch: { status: "failed", error: ADAPTATION_ERRORS.timeout },
        effect: { kind: "none" },
      };
    case "provider_error":
      return { patch: { status: "failed", error: input.message }, effect: { kind: "none" } };
    case "claim":
      if (job.status !== "queued") return unchanged;
      return {
        patch: { status: "running", attempt: 1 },
        effect: { kind: "create_session" },
      };
    case "snapshot":
      return snapshotStep(job, input.snapshot, input.ctx);
  }
};

const snapshotStep = (
  job: AdaptationJobRow,
  snapshot: DevinSessionSnapshot,
  ctx: ValidationContext,
): AdaptationStep => {
  if (job.status !== "running") return unchanged;

  // Output present in any phase: validate inline, then write the outcome.
  if (snapshot.structuredOutput !== undefined) {
    const result = validateComparisonPanel(snapshot.structuredOutput, ctx);
    const patch = {
      candidateSpec: snapshot.structuredOutput,
      validationErrors: result.ok ? [] : result.errors,
    };
    if (result.ok) {
      return {
        patch: {
          ...patch,
          status: "ready",
          acceptedSpec: result.spec,
          // oxlint-disable-next-line unicorn/no-null
          error: null,
        },
        effect: { kind: "none" },
      };
    }
    // A working session may publish a non-final candidate; only a terminal
    // phase makes the output final and fails the job.
    if (snapshot.phase === "working") return unchanged;
    return {
      patch: { ...patch, status: "failed", error: ADAPTATION_ERRORS.invalid },
      effect: { kind: "none" },
    };
  }

  if (snapshot.phase === "working") return unchanged;

  // finished, blocked or ended without output: v1 has no
  // structured_output_required, so the job fails with a safe message.
  return {
    patch: { status: "failed", error: ADAPTATION_ERRORS.noResult },
    effect: { kind: "none" },
  };
};
