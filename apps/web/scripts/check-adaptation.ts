import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";

// Force the mock provider before any module that reads lib/env.ts loads;
// process.env is allowed in scripts/ via a scoped .oxlintrc.json override.
// `--scenario valid|invalid_first|invalid_twice` picks the labelled mock
// fixture; env is parsed once, so each scenario is a separate process.
process.env.ADAPTATION_MODE = "mock";
const scenarioFlag = process.argv.indexOf("--scenario");
const scenario = scenarioFlag === -1 ? "valid" : (process.argv[scenarioFlag + 1] ?? "valid");
process.env.ADAPTATION_MOCK_SCENARIO = scenario;

const { client, db } = await import("~/lib/db/client");
const { adaptationCandidate, adaptationJob, listing, listingFeedback, searchProfile, user } =
  await import("~/lib/db/schema");
const { DEMO_PERSONA } = await import("~/lib/demo/persona");
const { resetDemo } = await import("~/lib/demo/reset");
const { recordFeedback, refineFeedback, undoFeedback } = await import("~/lib/feedback");
const { upsertProfile } = await import("~/lib/profile");
const { ADAPTATION_ERRORS } = await import("~/lib/adaptation/machine");
const { advanceAdaptation, retryAdaptation, startAdaptation } =
  await import("~/lib/adaptation/runner");
const { env } = await import("~/lib/env");

assert.equal(env.ADAPTATION_MODE, "mock");
assert.equal(env.ADAPTATION_MOCK_SCENARIO, scenario);

const TERMINAL = new Set(["ready", "failed", "stale"]);

const advanceUntilTerminal = async (userId: string, jobId: string, limit = 6) => {
  for (let i = 0; i < limit; i += 1) {
    const job = await advanceAdaptation(userId, jobId);
    if (job && TERMINAL.has(job.status)) return job;
  }
  throw new Error(`job ${jobId} did not reach a terminal state`);
};

const rowOf = async (jobId: string) => {
  const [row] = await db.select().from(adaptationJob).where(eq(adaptationJob.id, jobId));
  assert.ok(row);
  return row;
};
const candidatesOf = (jobId: string) =>
  db
    .select()
    .from(adaptationCandidate)
    .where(eq(adaptationCandidate.jobId, jobId))
    .orderBy(asc(adaptationCandidate.run), asc(adaptationCandidate.attempt));
const steps = (trace: { step: string }[]) => trace.map((event) => event.step);
const codes = (errors: readonly { code: string }[] | null | undefined) =>
  (errors ?? []).map((error) => error.code).sort();
const INVALID_CODES = ["missing_required_row", "unknown_listing"];

const [guest, other] = [randomUUID(), randomUUID()];
// One fixture listing per event: the feedback store folds a second rejection of the same
// listing into the existing active event, which would reuse the first job.
const fixtureIds = [0, 1, 2, 3].map(() => `adaptation-check:${randomUUID()}`);
const [fixtureId, fixtureB, fixtureC, fixtureOther] = fixtureIds as [
  string,
  string,
  string,
  string,
];
try {
  await db.insert(user).values([
    { id: guest, email: `${guest}@example.invalid`, isAnonymous: true },
    { id: other, email: `${other}@example.invalid`, isAnonymous: true },
  ]);
  // Distinct price and size per fixture: identical rows collapse in the feed's
  // dedupe step and the mock needs at least two candidates.
  await db.insert(listing).values(
    fixtureIds.map((id, index) => ({
      id,
      platform: "fotocasa",
      platformId: id,
      url: `https://example.invalid/${id}`,
      operation: "rent",
      title: `Adaptation isolation check ${index + 1}`,
      priceEur: 1700 + index * 40,
      builtM2: 60 + index * 5,
      neighbourhood: "Poblenou",
      amenities: ["exterior"],
    })),
  );
  await upsertProfile(guest, DEMO_PERSONA);
  await upsertProfile(other, DEMO_PERSONA);

  const startJob = async (
    listingId: string,
    reason: "missing_balcony" | "too_expensive" | "wrong_area",
  ) => {
    const event = await recordFeedback(guest, { eventId: randomUUID(), listingId, reason });
    const job = await startAdaptation(guest, event.eventId);
    assert.equal(job.status, "queued");
    assert.deepEqual(steps(job.trace), ["triggered"]);
    return { event, job };
  };

  if (scenario === "valid") {
    const eventA = await recordFeedback(guest, {
      eventId: randomUUID(),
      listingId: fixtureId,
      reason: "missing_balcony",
    });
    const jobA = await startAdaptation(guest, eventA.eventId);
    assert.equal(jobA.status, "queued");
    assert.equal(jobA.provider, "mock");
    // Dedupe: a repeated submission returns the same job.
    assert.equal((await startAdaptation(guest, eventA.eventId)).jobId, jobA.jobId);
    // Owner scoping: another user cannot see or advance the job.
    assert.equal(await advanceAdaptation(other, jobA.jobId), undefined);

    const done = await advanceUntilTerminal(guest, jobA.jobId);
    assert.equal(done.status, "ready");
    assert.ok(done.panel);
    assert.equal(done.panel.attempt, 1);
    assert.equal(done.panel.feedbackEventId, eventA.eventId);
    const [rowA] = await db.select().from(adaptationJob).where(eq(adaptationJob.id, jobA.jobId));
    assert.ok(rowA);
    for (const id of done.panel.listingIds) {
      assert.ok(rowA.sourceListingIds.includes(id));
      assert.notEqual(id, fixtureId);
    }

    // A free-form rejection has nothing to compare around and starts no job.
    const eventOther = await recordFeedback(guest, {
      eventId: randomUUID(),
      listingId: fixtureOther,
      reason: "other",
    });
    await assert.rejects(startAdaptation(guest, eventOther.eventId), { status: 409 });
    // Refining it to a structured reason makes the same event eligible.
    await refineFeedback(guest, eventOther.eventId, "wrong_area");
    const refined = await startAdaptation(guest, eventOther.eventId);
    assert.equal(refined.status, "queued");
    // Refining again to a different reason marks the briefed job stale.
    await refineFeedback(guest, eventOther.eventId, "too_expensive");
    assert.equal((await advanceAdaptation(guest, refined.jobId))?.status, "stale");

    // A queued job goes stale when the profile version drifts.
    const eventB = await recordFeedback(guest, {
      eventId: randomUUID(),
      listingId: fixtureB,
      reason: "too_expensive",
    });
    const jobB = await startAdaptation(guest, eventB.eventId);
    await upsertProfile(guest, { ...DEMO_PERSONA, maxPriceEur: 2400 });
    const staleByProfile = await advanceAdaptation(guest, jobB.jobId);
    assert.equal(staleByProfile?.status, "stale");
    // oxlint-disable-next-line unicorn/no-null
    assert.equal(staleByProfile?.panel, null);

    // A queued job goes stale when its feedback event is undone.
    const eventC = await recordFeedback(guest, {
      eventId: randomUUID(),
      listingId: fixtureC,
      reason: "wrong_area",
    });
    const jobC = await startAdaptation(guest, eventC.eventId);
    await undoFeedback(guest, eventC.eventId);
    const staleByUndo = await advanceAdaptation(guest, jobC.jobId);
    assert.equal(staleByUndo?.status, "stale");

    await resetDemo(guest, true);
    assert.equal(
      (await db.select().from(adaptationJob).where(eq(adaptationJob.userId, guest))).length,
      0,
    );
    assert.equal(
      (await db.select().from(listingFeedback).where(eq(listingFeedback.userId, guest))).length,
      0,
    );

    console.log(
      JSON.stringify(
        {
          result: "passed",
          checks: [
            "queued insert + dedupe on feedback event",
            "cross-user advance isolation",
            "free-form reason starts no job until refined",
            "refine to another reason marks the job stale",
            "mock session reaches ready with validated spec",
            "listingIds subset of source set, rejected listing excluded",
            "profile drift marks queued job stale",
            "undone feedback marks queued job stale",
            "resetDemo clears adaptation rows",
          ],
          job: done,
        },
        undefined,
        2,
      ),
    );
  } else if (scenario === "invalid_first") {
    // Labelled test fixture: the mock's first candidate is invalid, the
    // validator refuses it, one correction message goes back and the second
    // candidate is accepted.
    const { event, job } = await startJob(fixtureId, "missing_balcony");
    const done = await advanceUntilTerminal(guest, job.jobId);
    assert.equal(done.status, "ready");
    assert.equal(done.attempt, 2);
    assert.equal(done.run, 1);
    assert.ok(done.panel);
    assert.equal(done.panel.attempt, 2);
    assert.equal(done.panel.feedbackEventId, event.eventId);
    assert.deepEqual(steps(done.trace), [
      "triggered",
      "session_created",
      "proposed",
      "rejected",
      "correcting",
      "proposed",
      "accepted",
    ]);
    const rejectedStep = done.trace.find((step) => step.step === "rejected");
    assert.deepEqual(codes(rejectedStep?.errors), INVALID_CODES);
    const candidates = await candidatesOf(job.jobId);
    assert.equal(candidates.length, 2);
    const [first, second] = candidates;
    assert.ok(first && second);
    assert.equal(first.attempt, 1);
    assert.equal(first.accepted, false);
    assert.deepEqual(codes(first.errors), INVALID_CODES);
    assert.equal(second.attempt, 2);
    assert.equal(second.accepted, true);
    assert.deepEqual(second.errors, []);
    assert.notEqual(first.hash, second.hash);
    const row = await rowOf(job.jobId);
    assert.deepEqual(row.acceptedSpec, second.spec);
    assert.notDeepEqual(row.acceptedSpec, first.spec);
    // Rendering reads accepted_spec only; the refused candidate never became it.
    assert.deepEqual(done.panel, row.acceptedSpec);
    // A repeated trigger after the terminal state returns the same job untouched.
    const again = await startAdaptation(guest, event.eventId);
    assert.equal(again.jobId, job.jobId);
    assert.equal(again.run, 1);
    assert.equal(again.attempt, 2);
    // A ready job cannot be retried.
    await assert.rejects(retryAdaptation(guest, job.jobId), { status: 409 });
    await assert.rejects(retryAdaptation(other, job.jobId), { status: 404 });

    // Two tabs polling at once send exactly one correction.
    const raced = await startJob(fixtureB, "too_expensive");
    assert.equal((await advanceAdaptation(guest, raced.job.jobId))?.status, "running");
    assert.equal((await advanceAdaptation(guest, raced.job.jobId))?.status, "running");
    await Promise.all([
      advanceAdaptation(guest, raced.job.jobId),
      advanceAdaptation(guest, raced.job.jobId),
    ]);
    const racedRow = await rowOf(raced.job.jobId);
    assert.equal(racedRow.status, "correcting");
    assert.equal(racedRow.attempt, 2);
    assert.equal(steps(racedRow.trace).filter((step) => step === "correcting").length, 1);
    assert.equal((await candidatesOf(raced.job.jobId)).length, 1);

    // Profile drift while correcting discards the job without a panel; the
    // judged candidate stays on record.
    await upsertProfile(guest, { ...DEMO_PERSONA, maxPriceEur: 2400 });
    const stale = await advanceAdaptation(guest, raced.job.jobId);
    assert.equal(stale?.status, "stale");
    // oxlint-disable-next-line unicorn/no-null
    assert.equal(stale?.panel, null);
    assert.equal(steps(stale?.trace ?? []).at(-1), "stale");
    assert.equal((await candidatesOf(raced.job.jobId)).length, 1);
    await assert.rejects(retryAdaptation(guest, raced.job.jobId), { status: 409 });

    console.log(
      JSON.stringify(
        {
          result: "passed",
          scenario,
          checks: [
            "invalid first candidate refused with coded errors",
            "one correction message, second candidate accepted",
            "both candidates preserved with distinct hashes",
            "accepted_spec is the second candidate only",
            "trace triggered..accepted in order",
            "repeated trigger keeps job, run and attempt",
            "ready and foreign jobs cannot be retried",
            "concurrent polls send one correction",
            "profile drift while correcting marks stale",
          ],
          job: done,
        },
        undefined,
        2,
      ),
    );
  } else if (scenario === "invalid_twice") {
    // Labelled test fixture: both candidates invalid, the budget is spent and
    // the job fails; a deliberate retry opens run 2 with a new session.
    const { event, job } = await startJob(fixtureId, "missing_balcony");
    const failed = await advanceUntilTerminal(guest, job.jobId);
    assert.equal(failed.status, "failed");
    assert.equal(failed.error, ADAPTATION_ERRORS.exhausted);
    // oxlint-disable-next-line unicorn/no-null
    assert.equal(failed.panel, null);
    assert.deepEqual(steps(failed.trace).slice(-3), ["proposed", "rejected", "failed"]);
    const firstRun = await candidatesOf(job.jobId);
    assert.equal(firstRun.length, 2);
    assert.ok(firstRun.every((candidate) => candidate.run === 1 && !candidate.accepted));
    const failedRow = await rowOf(job.jobId);
    // oxlint-disable-next-line unicorn/no-null
    assert.equal(failedRow.acceptedSpec, null);
    const firstSession = failedRow.providerSessionId;
    assert.ok(firstSession);

    // A refresh (trigger or poll) never resets the budget.
    const again = await startAdaptation(guest, event.eventId);
    assert.equal(again.jobId, job.jobId);
    assert.equal(again.run, 1);
    assert.equal(again.attempt, 2);
    assert.equal((await advanceAdaptation(guest, job.jobId))?.run, 1);

    // Only the deliberate control opens a new run.
    const retried = await retryAdaptation(guest, job.jobId);
    assert.equal(retried.jobId, job.jobId);
    assert.equal(retried.status, "queued");
    assert.equal(retried.run, 2);
    assert.equal(retried.attempt, 0);
    // oxlint-disable-next-line unicorn/no-null
    assert.equal(retried.error, null);
    assert.deepEqual(retried.trace.at(-1)?.step, "retried");
    assert.equal(retried.trace.at(-1)?.run, 2);
    assert.equal((await candidatesOf(job.jobId)).length, 2);
    await assert.rejects(retryAdaptation(guest, job.jobId), { status: 409 });

    const secondFailure = await advanceUntilTerminal(guest, job.jobId);
    assert.equal(secondFailure.status, "failed");
    assert.equal(secondFailure.run, 2);
    const secondRow = await rowOf(job.jobId);
    assert.ok(secondRow.providerSessionId);
    assert.notEqual(secondRow.providerSessionId, firstSession);
    const allCandidates = await candidatesOf(job.jobId);
    assert.deepEqual(
      allCandidates.map((candidate) => [candidate.run, candidate.attempt]),
      [
        [1, 1],
        [1, 2],
        [2, 1],
        [2, 2],
      ],
    );
    assert.equal(allCandidates[2]?.providerSessionId, secondRow.providerSessionId);

    console.log(
      JSON.stringify(
        {
          result: "passed",
          scenario,
          checks: [
            "second invalid candidate exhausts the budget",
            "no accepted_spec after failure",
            "trigger and poll never reset run or attempt",
            "retry opens run 2 queued with a retried trace step",
            "run 1 candidates preserved, run 2 uses a new session",
            "four candidates across two runs",
          ],
          job: secondFailure,
        },
        undefined,
        2,
      ),
    );
  } else {
    throw new Error(`unknown scenario ${scenario}`);
  }
} finally {
  await db.delete(searchProfile).where(inArray(searchProfile.userId, [guest, other]));
  await db.delete(user).where(inArray(user.id, [guest, other]));
  await db.delete(listing).where(inArray(listing.id, fixtureIds));
  await client.end();
}
