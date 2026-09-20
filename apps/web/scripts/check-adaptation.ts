import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";

// Force the mock provider before any module that reads lib/env.ts loads;
// process.env is allowed in scripts/ via a scoped .oxlintrc.json override.
process.env.ADAPTATION_MODE = "mock";

const { client, db } = await import("~/lib/db/client");
const { adaptationJob, listing, listingFeedback, searchProfile, user } =
  await import("~/lib/db/schema");
const { DEMO_PERSONA } = await import("~/lib/demo/persona");
const { resetDemo } = await import("~/lib/demo/reset");
const { recordFeedback, refineFeedback, undoFeedback } = await import("~/lib/feedback");
const { upsertProfile } = await import("~/lib/profile");
const { advanceAdaptation, startAdaptation } = await import("~/lib/adaptation/runner");
const { env } = await import("~/lib/env");

assert.equal(env.ADAPTATION_MODE, "mock");

const TERMINAL = new Set(["ready", "failed", "stale"]);

const advanceUntilTerminal = async (userId: string, jobId: string, limit = 6) => {
  for (let i = 0; i < limit; i += 1) {
    const job = await advanceAdaptation(userId, jobId);
    if (job && TERMINAL.has(job.status)) return job;
  }
  throw new Error(`job ${jobId} did not reach a terminal state`);
};

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
  await db.insert(listing).values(
    fixtureIds.map((id) => ({
      id,
      platform: "fotocasa",
      platformId: id,
      url: `https://example.invalid/${id}`,
      operation: "rent",
      title: "Adaptation isolation check",
      priceEur: 1700,
      neighbourhood: "Poblenou",
      amenities: ["exterior"],
    })),
  );
  await upsertProfile(guest, DEMO_PERSONA);
  await upsertProfile(other, DEMO_PERSONA);

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
} finally {
  await db.delete(searchProfile).where(inArray(searchProfile.userId, [guest, other]));
  await db.delete(user).where(inArray(user.id, [guest, other]));
  await db.delete(listing).where(inArray(listing.id, fixtureIds));
  await client.end();
}
