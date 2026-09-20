import { describe, expect, it } from "vitest";
import type { AdaptationJobRow } from "~/lib/db/schema";
import type { DevinSessionSnapshot } from "~/lib/devin/client";
import { hashCandidate } from "~/lib/adaptation/hash";
import { ADAPTATION_ERRORS, nextStep, type AdaptationStepInput } from "~/lib/adaptation/machine";
import type { CandidateFacts } from "~/lib/adaptation/types";
import type { ValidationContext } from "~/lib/adaptation/validate";

const NOW = new Date("2026-09-20T10:00:00.000Z");

const facts = (id: string, amenities: string[]): CandidateFacts => ({
  id,
  title: `Listing ${id}`,
  priceEur: 1500,
  neighbourhood: "Gràcia",
  rooms: 2,
  builtM2: 70,
  amenities,
});

const ctx: ValidationContext = {
  feedbackEventId: "550e8400-e29b-41d4-a716-446655440000",
  profileVersion: `sha256:${"a".repeat(64)}`,
  focus: "missing_balcony",
  sourceListingIds: ["fotocasa:1", "fotocasa:2"],
  expectedAttempt: 1,
  rejectedListingId: "fotocasa:0",
  rejectedListingIds: ["fotocasa:0"],
  redLineListingIds: [],
  facts: {
    "fotocasa:0": facts("fotocasa:0", ["exterior"]),
    "fotocasa:1": facts("fotocasa:1", ["exterior", "balcony"]),
    "fotocasa:2": facts("fotocasa:2", ["exterior"]),
  },
};

const validSpec = {
  schemaVersion: 1,
  feedbackEventId: ctx.feedbackEventId,
  profileVersion: ctx.profileVersion,
  focus: "missing_balcony",
  attempt: 1,
  title: "Homes with outdoor space",
  listingIds: ["fotocasa:1", "fotocasa:2"],
  rows: [{ field: "balcony", label: "Balcony" }],
  actions: ["open_listing"],
};
const badSpec = { ...validSpec, listingIds: ["fotocasa:1", "fotocasa:9"] };
const correctedSpec = { ...validSpec, attempt: 2, title: "Homes with a balcony" };

const job = (over: Partial<AdaptationJobRow> = {}): AdaptationJobRow => ({
  id: "660e8400-e29b-41d4-a716-446655440000",
  userId: "770e8400-e29b-41d4-a716-446655440000",
  feedbackEventId: ctx.feedbackEventId,
  profileVersion: ctx.profileVersion,
  focus: "missing_balcony",
  status: "running",
  provider: "mock",
  attempt: 1,
  run: 1,
  sourceListingIds: [...ctx.sourceListingIds],
  providerSessionId: "mock-session-1",
  providerSessionUrl: null,
  candidateSpec: null,
  acceptedSpec: null,
  validationErrors: null,
  trace: [{ at: "2026-09-20T09:59:00.000Z", step: "triggered" }],
  error: null,
  deadlineAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const correcting = (over: Partial<AdaptationJobRow> = {}) =>
  job({ status: "correcting", attempt: 2, candidateSpec: badSpec, ...over });

const snapshot = (
  phase: DevinSessionSnapshot["phase"],
  structuredOutput?: unknown,
  priorHashes: readonly string[] = [],
  expectedAttempt = 1,
): AdaptationStepInput => ({
  kind: "snapshot",
  snapshot: { sessionId: "s", url: "u", phase, structuredOutput },
  ctx: { ...ctx, expectedAttempt },
  priorHashes,
});

const steps = (patch: Partial<AdaptationJobRow>) => patch.trace?.map((event) => event.step);

describe("nextStep", () => {
  it("claims a queued job with attempt 1 and a create_session effect", () => {
    const step = nextStep(job({ status: "queued", attempt: 0 }), { kind: "claim" });
    expect(step.patch.status).toBe("running");
    expect(step.patch.attempt).toBe(1);
    expect(step.effect).toEqual({ kind: "create_session" });
  });

  it("keeps polling on a working snapshot without output", () => {
    const step = nextStep(job(), snapshot("working"));
    expect(step.patch).toEqual({});
    expect(step.effect.kind).toBe("none");
  });

  it.each(["working", "finished", "blocked"] as const)(
    "accepts valid output in phase %s",
    (phase) => {
      const step = nextStep(job(), snapshot(phase, validSpec), NOW);
      expect(step.patch.status).toBe("ready");
      expect(step.patch.acceptedSpec).toEqual(validSpec);
      expect(step.patch.candidateSpec).toEqual(validSpec);
      expect(step.patch.validationErrors).toEqual([]);
      expect(step.effect.kind).toBe("none");
      expect(step.candidate).toEqual({
        attempt: 1,
        spec: validSpec,
        hash: hashCandidate(validSpec),
        errors: [],
        accepted: true,
      });
      expect(steps(step.patch)).toEqual(["triggered", "proposed", "accepted"]);
    },
  );

  it("keeps polling on invalid output while the session is still working", () => {
    const step = nextStep(job(), snapshot("working", badSpec));
    expect(step.patch).toEqual({});
    expect(step.effect.kind).toBe("none");
  });

  it("asks for one correction after a final invalid first candidate", () => {
    const step = nextStep(job(), snapshot("blocked", badSpec), NOW);
    expect(step.patch.status).toBe("correcting");
    expect(step.patch.attempt).toBe(2);
    expect(step.patch.candidateSpec).toEqual(badSpec);
    expect(step.patch.acceptedSpec).toBeUndefined();
    const errors = step.patch.validationErrors ?? [];
    expect(errors.map((error) => error.code)).toEqual(["unknown_listing"]);
    expect(step.effect).toEqual({ kind: "send_correction", errors, attempt: 2 });
    expect(step.candidate).toEqual({
      attempt: 1,
      spec: badSpec,
      hash: hashCandidate(badSpec),
      errors,
      accepted: false,
    });
    expect(steps(step.patch)).toEqual(["triggered", "proposed", "rejected", "correcting"]);
    expect(step.patch.trace?.[2]?.errors).toEqual(errors);
    expect(
      step.patch.trace?.every(
        (event) => event.at === NOW.toISOString() || event.step === "triggered",
      ),
    ).toBe(true);
  });

  it("fails a final invalid candidate once the budget is spent", () => {
    const step = nextStep(job({ attempt: 2 }), snapshot("finished", badSpec, [], 2), NOW);
    expect(step.patch.status).toBe("failed");
    expect(step.patch.error).toBe(ADAPTATION_ERRORS.exhausted);
    expect(step.candidate?.accepted).toBe(false);
    expect(step.effect.kind).toBe("none");
  });

  describe("while correcting", () => {
    const prior = [hashCandidate(badSpec)];

    it.each(["working", "blocked", "finished"] as const)(
      "treats the previous output in phase %s as not yet answered",
      (phase) => {
        const step = nextStep(correcting(), snapshot(phase, badSpec, prior, 2), NOW);
        expect(step.patch).toEqual({});
        expect(step.effect.kind).toBe("none");
      },
    );

    it("treats a re-keyed copy of the previous output as the same candidate", () => {
      const reordered = { ...badSpec, actions: [...badSpec.actions], attempt: 1 };
      const step = nextStep(correcting(), snapshot("blocked", reordered, prior, 2));
      expect(step.patch).toEqual({});
    });

    it("keeps waiting without output unless the session ended", () => {
      expect(nextStep(correcting(), snapshot("blocked", undefined, prior, 2)).patch).toEqual({});
      const ended = nextStep(correcting(), snapshot("ended", undefined, prior, 2), NOW);
      expect(ended.patch.status).toBe("failed");
      expect(ended.patch.error).toBe(ADAPTATION_ERRORS.noResult);
    });

    it("accepts a fresh valid second candidate", () => {
      const step = nextStep(correcting(), snapshot("blocked", correctedSpec, prior, 2), NOW);
      expect(step.patch.status).toBe("ready");
      expect(step.patch.acceptedSpec).toEqual(correctedSpec);
      expect(step.candidate).toEqual({
        attempt: 2,
        spec: correctedSpec,
        hash: hashCandidate(correctedSpec),
        errors: [],
        accepted: true,
      });
      expect(steps(step.patch)).toEqual(["triggered", "proposed", "accepted"]);
    });

    it("keeps polling on a fresh invalid candidate while working", () => {
      const step = nextStep(
        correcting(),
        snapshot("working", { ...correctedSpec, focus: "wrong_area" }, prior, 2),
      );
      expect(step.patch).toEqual({});
    });

    it("fails a fresh invalid final second candidate (retry exhaustion)", () => {
      const stillBad = { ...badSpec, attempt: 2, title: "Second try" };
      const step = nextStep(correcting(), snapshot("blocked", stillBad, prior, 2), NOW);
      expect(step.patch.status).toBe("failed");
      expect(step.patch.error).toBe(ADAPTATION_ERRORS.exhausted);
      expect(step.patch.candidateSpec).toEqual(stillBad);
      expect(step.candidate?.attempt).toBe(2);
      expect(step.candidate?.accepted).toBe(false);
      expect(step.effect.kind).toBe("none");
      expect(steps(step.patch)).toEqual(["triggered", "proposed", "rejected", "failed"]);
    });

    it("counts a changed output that still echoes attempt 1 as the final second candidate", () => {
      const step = nextStep(
        correcting(),
        snapshot("blocked", { ...validSpec, title: "Changed" }, prior, 2),
        NOW,
      );
      expect(step.patch.status).toBe("failed");
      expect(step.patch.validationErrors?.map((error) => error.code)).toEqual(["wrong_attempt"]);
    });

    it("goes stale, times out and records provider errors like a running job", () => {
      expect(nextStep(correcting(), { kind: "stale" }, NOW).patch).toMatchObject({
        status: "stale",
        trace: expect.arrayContaining([expect.objectContaining({ step: "stale" })]),
      });
      const timeout = nextStep(correcting(), { kind: "timeout" }, NOW);
      expect(timeout.patch.status).toBe("failed");
      expect(timeout.patch.error).toBe(ADAPTATION_ERRORS.timeout);
      expect(steps(timeout.patch)).toEqual(["triggered", "failed"]);
      const provider = nextStep(correcting(), {
        kind: "provider_error",
        message: ADAPTATION_ERRORS.provider,
      });
      expect(provider.patch.status).toBe("failed");
    });
  });

  it.each(["finished", "blocked", "ended"] as const)("fails on %s without output", (phase) => {
    const step = nextStep(job(), snapshot(phase), NOW);
    expect(step.patch.status).toBe("failed");
    expect(step.patch.error).toBe(ADAPTATION_ERRORS.noResult);
    expect(step.effect.kind).toBe("none");
    expect(steps(step.patch)).toEqual(["triggered", "failed"]);
  });

  it("fails on provider_error with the safe message", () => {
    const step = nextStep(job(), {
      kind: "provider_error",
      message: ADAPTATION_ERRORS.provider,
    });
    expect(step.patch.status).toBe("failed");
    expect(step.patch.error).toBe(ADAPTATION_ERRORS.provider);
  });

  it.each(["queued", "running"] as const)("marks %s stale without a spec", (status) => {
    const step = nextStep(job({ status }), { kind: "stale" });
    expect(step.patch.status).toBe("stale");
    expect(step.patch.acceptedSpec).toBeUndefined();
  });

  it.each(["queued", "running"] as const)("fails %s on timeout", (status) => {
    const step = nextStep(job({ status }), { kind: "timeout" });
    expect(step.patch.status).toBe("failed");
    expect(step.patch.error).toBe(ADAPTATION_ERRORS.timeout);
  });

  it.each(["ready", "failed", "stale"] as const)(
    "terminal %s is immutable for every input",
    (status) => {
      const inputs: AdaptationStepInput[] = [
        { kind: "claim" },
        snapshot("finished", validSpec),
        { kind: "provider_error", message: "x" },
        { kind: "stale" },
        { kind: "timeout" },
      ];
      for (const input of inputs) {
        const step = nextStep(job({ status }), input);
        expect(step.patch).toEqual({});
        expect(step.effect.kind).toBe("none");
      }
    },
  );

  it("ignores claim and snapshot on non-matching states", () => {
    expect(nextStep(job({ status: "running" }), { kind: "claim" }).patch).toEqual({});
    expect(nextStep(job({ status: "queued" }), snapshot("finished", validSpec)).patch).toEqual({});
  });
});
