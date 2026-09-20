import { describe, expect, it } from "vitest";
import type { AdaptationJobRow } from "~/lib/db/schema";
import type { DevinSessionSnapshot } from "~/lib/devin/client";
import { ADAPTATION_ERRORS, nextStep, type AdaptationStepInput } from "~/lib/adaptation/machine";
import type { ValidationContext } from "~/lib/adaptation/validate";

const ctx: ValidationContext = {
  feedbackEventId: "550e8400-e29b-41d4-a716-446655440000",
  profileVersion: `sha256:${"a".repeat(64)}`,
  focus: "missing_balcony",
  sourceListingIds: ["fotocasa:1", "fotocasa:2"],
  expectedAttempt: 1,
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

const job = (over: Partial<AdaptationJobRow> = {}): AdaptationJobRow => ({
  id: "660e8400-e29b-41d4-a716-446655440000",
  userId: "770e8400-e29b-41d4-a716-446655440000",
  feedbackEventId: ctx.feedbackEventId,
  profileVersion: ctx.profileVersion,
  focus: "missing_balcony",
  status: "running",
  provider: "mock",
  attempt: 1,
  sourceListingIds: [...ctx.sourceListingIds],
  providerSessionId: "mock-session-1",
  providerSessionUrl: null,
  candidateSpec: null,
  acceptedSpec: null,
  validationErrors: null,
  error: null,
  deadlineAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const snapshot = (
  phase: DevinSessionSnapshot["phase"],
  structuredOutput?: unknown,
): AdaptationStepInput => ({
  kind: "snapshot",
  snapshot: { sessionId: "s", url: "u", phase, structuredOutput },
  ctx,
});

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
      const step = nextStep(job(), snapshot(phase, validSpec));
      expect(step.patch.status).toBe("ready");
      expect(step.patch.acceptedSpec).toEqual(validSpec);
      expect(step.patch.candidateSpec).toEqual(validSpec);
      expect(step.patch.validationErrors).toEqual([]);
      expect(step.effect.kind).toBe("none");
    },
  );

  it("fails invalid output, storing candidate_spec and coded errors", () => {
    const bad = { ...validSpec, focus: "wrong_area" };
    const step = nextStep(job(), snapshot("finished", bad));
    expect(step.patch.status).toBe("failed");
    expect(step.patch.error).toBe(ADAPTATION_ERRORS.invalid);
    expect(step.patch.candidateSpec).toEqual(bad);
    expect(step.patch.validationErrors?.length).toBeGreaterThan(0);
    expect(step.patch.validationErrors?.[0]?.code).toBeDefined();
    expect(step.effect.kind).toBe("none");
  });

  it("keeps polling on invalid output while the session is still working", () => {
    const bad = { ...validSpec, focus: "wrong_area" };
    const step = nextStep(job(), snapshot("working", bad));
    expect(step.patch).toEqual({});
    expect(step.effect.kind).toBe("none");
  });

  it("fails output whose attempt does not match the job", () => {
    const step = nextStep(job(), snapshot("finished", { ...validSpec, attempt: 2 }));
    expect(step.patch.status).toBe("failed");
    expect(step.patch.validationErrors?.[0]?.code).toBe("wrong_attempt");
  });

  it.each(["finished", "blocked", "ended"] as const)("fails on %s without output", (phase) => {
    const step = nextStep(job(), snapshot(phase));
    expect(step.patch.status).toBe("failed");
    expect(step.patch.error).toBe(ADAPTATION_ERRORS.noResult);
    expect(step.effect.kind).toBe("none");
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
