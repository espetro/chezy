import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SearchProfileInputSchema } from "@chezy/contract";
import { eq, inArray } from "drizzle-orm";
import * as v from "valibot";

import { client, db } from "~/lib/db/client";
import { searchProfile, user } from "~/lib/db/schema";
import { DEMO_CANDIDATE_IDS, DEMO_PERSONA } from "~/lib/demo/persona";
import { resetDemo } from "~/lib/demo/reset";
import { buildFeed } from "~/lib/feed";
import { getProfile, upsertProfile } from "~/lib/profile";

const ids = [randomUUID(), randomUUID()];
const [guestId, otherId] = ids;

try {
  await db.insert(user).values(
    ids.map((id) => ({
      id,
      email: `demo-check-${id.slice(0, 8)}@example.invalid`,
      isAnonymous: true,
      profile: { freeformRequirements: ["stale preference"] },
    })),
  );
  await upsertProfile(guestId, { ...DEMO_PERSONA, maxPriceEur: 1000 });
  await upsertProfile(otherId, { ...DEMO_PERSONA, maxPriceEur: 900 });
  const otherBefore = await getProfile(otherId);
  const [otherUserBefore] = await db.select().from(user).where(eq(user.id, otherId));

  await resetDemo(guestId, false);
  assert.equal(await getProfile(guestId), undefined);
  const [emptyUser] = await db.select().from(user).where(eq(user.id, guestId));
  // oxlint-disable-next-line unicorn/no-null
  assert.equal(emptyUser.profile, null);

  const first = await resetDemo(guestId, true);
  assert.ok(first.profile);
  assert.deepEqual(v.parse(SearchProfileInputSchema, first.profile), DEMO_PERSONA);
  assert.equal(first.profile.verified, false);
  const firstFeed = await buildFeed(first.profile);
  assert.ok(firstFeed.items.length >= 3, "Run mise run demo:setup to seed the fixture listings");
  const candidateIds = firstFeed.items.map(({ listing }) => listing.id);
  for (const id of DEMO_CANDIDATE_IDS) assert.ok(candidateIds.includes(id), `Missing ${id}`);

  const second = await resetDemo(guestId, true);
  assert.ok(second.profile);
  assert.deepEqual(v.parse(SearchProfileInputSchema, second.profile), DEMO_PERSONA);
  assert.deepEqual(
    (await buildFeed(second.profile)).items.map(({ listing }) => listing.id),
    candidateIds,
  );
  assert.deepEqual(await getProfile(guestId), second.profile);
  const [seededUser] = await db.select().from(user).where(eq(user.id, guestId));
  assert.equal(seededUser.profile?.budgetMaxEur, 2500);
  assert.equal(seededUser.profile?.freeformRequirements, undefined);

  await assert.rejects(
    resetDemo(guestId, false, [
      async (transaction, userId) => {
        assert.equal(userId, guestId);
        await transaction.delete(searchProfile).where(eq(searchProfile.userId, userId));
        throw new Error("cleanup failed");
      },
    ]),
    /cleanup failed/,
  );
  assert.deepEqual(await getProfile(guestId), second.profile);
  const [afterRollback] = await db.select().from(user).where(eq(user.id, guestId));
  assert.deepEqual(afterRollback.profile, seededUser.profile);

  await Promise.all([resetDemo(guestId, true), resetDemo(guestId, true)]);
  assert.deepEqual(v.parse(SearchProfileInputSchema, await getProfile(guestId)), DEMO_PERSONA);
  assert.deepEqual(await getProfile(otherId), otherBefore);
  const [otherUserAfter] = await db.select().from(user).where(eq(user.id, otherId));
  assert.deepEqual(otherUserAfter, otherUserBefore);
  console.log(
    JSON.stringify(
      {
        result: "passed",
        checks: [
          "empty reset",
          "persona twice",
          "fixture candidates",
          "mirror cleared",
          "rollback",
          "concurrent resets",
          "second-user isolation",
        ],
        candidateIds,
        relaxed: firstFeed.relaxed,
      },
      undefined,
      2,
    ),
  );
} finally {
  await db.delete(searchProfile).where(inArray(searchProfile.userId, ids));
  await db.delete(user).where(inArray(user.id, ids));
  await client.end();
}
