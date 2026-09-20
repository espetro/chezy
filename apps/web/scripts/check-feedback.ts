import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { FeedbackEventSchema } from "@chezy/contract";
import { eq, inArray } from "drizzle-orm";
import * as v from "valibot";
import { client, db } from "~/lib/db/client";
import { listing, listingFeedback, searchProfile, user } from "~/lib/db/schema";
import { DEMO_PERSONA } from "~/lib/demo/persona";
import { resetDemo } from "~/lib/demo/reset";
import { getFeedbackEvent, listActiveFeedback, recordFeedback, undoFeedback } from "~/lib/feedback";
import { buildFeed } from "~/lib/feed";
import { getProfileVersion } from "~/lib/profile-version";
import { getProfile, upsertProfile } from "~/lib/profile";

const ids = [randomUUID(), randomUUID()];
const [guest, other] = ids;
const fixtureId = `feedback-check:${randomUUID()}`;
try {
  await db
    .insert(user)
    .values(ids.map((id) => ({ id, email: `${id}@example.invalid`, isAnonymous: true })));
  await db.insert(listing).values({
    id: fixtureId,
    platform: "fotocasa",
    platformId: fixtureId,
    url: `https://example.invalid/${fixtureId}`,
    operation: "rent",
    title: "Feedback isolation check",
    priceEur: 1700,
    neighbourhood: "Poblenou",
    amenities: ["exterior"],
  });
  const profile = await upsertProfile(guest, DEMO_PERSONA);
  await upsertProfile(other, DEMO_PERSONA);
  const baseline = await buildFeed(profile);
  const input = { eventId: randomUUID(), listingId: fixtureId, reason: "missing_balcony" } as const;
  const recorded = await Promise.all([
    recordFeedback(guest, input),
    recordFeedback(guest, input),
    recordFeedback(guest, { ...input, eventId: randomUUID() }),
  ]);
  assert.equal(new Set(recorded.map((event) => event.eventId)).size, 1);
  const first = v.parse(FeedbackEventSchema, recorded[0]);
  assert.equal(first.userId, guest);
  assert.equal(first.profileVersion, getProfileVersion(profile));
  assert.deepEqual(first.facts, {
    priceEur: 1700,
    neighbourhood: "Poblenou",
    amenities: ["exterior"],
  });
  assert.equal((await listActiveFeedback(guest)).length, 1);
  assert.equal((await listActiveFeedback(other)).length, 0);
  assert.equal(await getFeedbackEvent(other, first.eventId), undefined);
  await assert.rejects(undoFeedback(other, first.eventId), /not found/);
  await assert.rejects(recordFeedback(guest, { ...input, reason: "wrong_area" }), /already used/);
  const reloaded = await listActiveFeedback(guest);
  assert.deepEqual(reloaded, [first]);
  const otherEvent = await recordFeedback(other, input);
  assert.equal(otherEvent.eventId, first.eventId);
  assert.notEqual(otherEvent.profileVersion, first.profileVersion);
  const undone = await undoFeedback(guest, first.eventId);
  assert.ok(undone.undoneAt);
  assert.deepEqual(await undoFeedback(guest, first.eventId), undone);
  assert.deepEqual(await recordFeedback(guest, input), undone);
  assert.equal((await listActiveFeedback(guest)).length, 0);
  assert.deepEqual((await buildFeed(profile)).items, baseline.items);
  assert.equal((await listActiveFeedback(other)).length, 1);
  const second = await recordFeedback(guest, { ...input, eventId: randomUUID() });
  assert.notEqual(second.eventId, first.eventId);
  const changedProfile = await upsertProfile(guest, { ...DEMO_PERSONA, maxPriceEur: 2400 });
  assert.notEqual(getProfileVersion(changedProfile), first.profileVersion);
  assert.equal(
    (await getFeedbackEvent(guest, first.eventId))?.profileVersion,
    first.profileVersion,
  );
  await assert.rejects(
    resetDemo(guest, false, [
      async (transaction, userId) => {
        await transaction.delete(listingFeedback).where(eq(listingFeedback.userId, userId));
        throw new Error("test rollback");
      },
    ]),
    /test rollback/,
  );
  assert.equal((await listActiveFeedback(guest)).length, 1);
  await resetDemo(guest, true);
  assert.equal((await listActiveFeedback(guest)).length, 0);
  assert.equal(await getFeedbackEvent(guest, first.eventId), undefined);
  assert.equal((await listActiveFeedback(other)).length, 1);
  assert.ok(await getProfile(guest));
  console.log(
    JSON.stringify(
      {
        result: "passed",
        checks: [
          "concurrent dedupe",
          "reload",
          "server version/facts",
          "cross-user read/write/undo isolation",
          "idempotent Undo",
          "late retry stays undone",
          "new rejection after Undo",
          "profile change",
          "reset rollback",
          "per-user reset cleanup",
        ],
        sampleEvent: first,
      },
      undefined,
      2,
    ),
  );
} finally {
  await db.delete(searchProfile).where(inArray(searchProfile.userId, ids));
  await db.delete(user).where(inArray(user.id, ids));
  await db.delete(listing).where(eq(listing.id, fixtureId));
  await client.end();
}
