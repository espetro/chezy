import type { PanelValidationError, TraceEvent } from "@chezy/contract";
import { hashCandidate } from "~/lib/adaptation/hash";
import { validateComparisonPanel, type ValidationContext } from "~/lib/adaptation/validate";
import { ADAPTATION_MAX_ATTEMPTS } from "~/lib/constants";
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
  exhausted:
    "Devin's corrected comparison still didn't match your listings. Your feed is unchanged.",
  timeout: "Timed out",
} as const;

export type AdaptationStepInput =
  | { kind: "claim" }
  | {
      kind: "snapshot";
      snapshot: DevinSessionSnapshot;
      ctx: ValidationContext;
      // Hashes of every candidate already judged in this run; the same output
      // seen again after a correction message is "not yet", not a new candidate.
      priorHashes: readonly string[];
    }
  | { kind: "provider_error"; message: string }
  | { kind: "stale" }
  | { kind: "timeout" };

export type AdaptationEffect =
  | { kind: "create_session" }
  | { kind: "send_correction"; errors: PanelValidationError[]; attempt: number }
  | { kind: "none" };

// A judged provider output, persisted to adaptation_candidate by the runner in
// the same transaction as the patch.
export interface JudgedCandidate {
  attempt: number;
  spec: unknown;
  hash: string;
  errors: PanelValidationError[];
  accepted: boolean;
}

export interface AdaptationStep {
  patch: Partial<AdaptationJobRow>;
  effect: AdaptationEffect;
  candidate?: JudgedCandidate;
}

const TERMINAL = new Set(["ready", "failed", "stale"]);
const unchanged: AdaptationStep = { patch: {}, effect: { kind: "none" } };
const none: AdaptationEffect = { kind: "none" };

const event = (
  now: Date,
  step: TraceEvent["step"],
  rest: Omit<TraceEvent, "at" | "step"> = {},
): TraceEvent => ({ at: now.toISOString(), step, ...rest });

const withTrace = (job: AdaptationJobRow, ...events: TraceEvent[]): TraceEvent[] => [
  ...job.trace,
  ...events,
];

// Pure transition function. The "validating" status is transient inside one
// snapshot step (validate inline, then write the outcome); it is never
// persisted. One correction is allowed: an invalid final candidate on attempt
// 1 moves the job to "correcting" and the runner sends the errors back to the
// same session; the second candidate is final either way.
export const nextStep = (
  job: AdaptationJobRow,
  input: AdaptationStepInput,
  now: Date = new Date(),
): AdaptationStep => {
  if (TERMINAL.has(job.status)) return unchanged;
  switch (input.kind) {
    case "stale":
      // Never writes accepted_spec; the panel is discarded.
      return {
        patch: { status: "stale", trace: withTrace(job, event(now, "stale")) },
        effect: none,
      };
    case "timeout":
      return {
        patch: {
          status: "failed",
          error: ADAPTATION_ERRORS.timeout,
          trace: withTrace(job, event(now, "failed", { message: ADAPTATION_ERRORS.timeout })),
        },
        effect: none,
      };
    case "provider_error":
      return {
        patch: {
          status: "failed",
          error: input.message,
          trace: withTrace(job, event(now, "failed", { message: input.message })),
        },
        effect: none,
      };
    case "claim":
      if (job.status !== "queued") return unchanged;
      return {
        patch: { status: "running", attempt: 1 },
        effect: { kind: "create_session" },
      };
    case "snapshot":
      return snapshotStep(job, input.snapshot, input.ctx, input.priorHashes, now);
  }
};

const snapshotStep = (
  job: AdaptationJobRow,
  snapshot: DevinSessionSnapshot,
  ctx: ValidationContext,
  priorHashes: readonly string[],
  now: Date,
): AdaptationStep => {
  if (job.status !== "running" && job.status !== "correcting") return unchanged;

  const output = snapshot.structuredOutput;
  const hash = output === undefined ? undefined : hashCandidate(output);
  // After a correction message the session still serves the previous output
  // until it publishes again; only a new hash is a new candidate.
  const fresh = hash !== undefined && !priorHashes.includes(hash);

  if (output !== undefined && hash !== undefined && fresh) {
    const result = validateComparisonPanel(output, ctx);
    const candidate: JudgedCandidate = {
      attempt: job.attempt,
      spec: output,
      hash,
      errors: result.ok ? [] : result.errors,
      accepted: result.ok,
    };
    const proposed = event(now, "proposed", { attempt: job.attempt });
    const latest = { candidateSpec: output, validationErrors: candidate.errors };
    if (result.ok) {
      return {
        patch: {
          ...latest,
          status: "ready",
          acceptedSpec: result.spec,
          // oxlint-disable-next-line unicorn/no-null
          error: null,
          trace: withTrace(job, proposed, event(now, "accepted", { attempt: job.attempt })),
        },
        effect: none,
        candidate,
      };
    }
    // A working session may publish a non-final candidate; only a terminal
    // phase makes the output final.
    if (snapshot.phase === "working") return unchanged;
    const rejected = event(now, "rejected", { attempt: job.attempt, errors: candidate.errors });
    if (job.attempt < ADAPTATION_MAX_ATTEMPTS) {
      const attempt = job.attempt + 1;
      return {
        patch: {
          ...latest,
          status: "correcting",
          attempt,
          trace: withTrace(job, proposed, rejected, event(now, "correcting", { attempt })),
        },
        effect: { kind: "send_correction", errors: candidate.errors, attempt },
        candidate,
      };
    }
    const message = job.attempt > 1 ? ADAPTATION_ERRORS.exhausted : ADAPTATION_ERRORS.invalid;
    return {
      patch: {
        ...latest,
        status: "failed",
        error: message,
        trace: withTrace(job, proposed, rejected, event(now, "failed", { message })),
      },
      effect: none,
      candidate,
    };
  }

  // No output, or the output already judged: keep waiting while the session
  // can still publish. In "correcting" a blocked session may simply not have
  // woken up yet, so only an ended session fails; the deadline covers the rest.
  if (snapshot.phase === "working") return unchanged;
  if (job.status === "correcting" && snapshot.phase !== "ended") return unchanged;

  // finished, blocked or ended without output: v1 has no
  // structured_output_required, so the job fails with a safe message.
  return {
    patch: {
      status: "failed",
      error: ADAPTATION_ERRORS.noResult,
      trace: withTrace(job, event(now, "failed", { message: ADAPTATION_ERRORS.noResult })),
    },
    effect: none,
  };
};
