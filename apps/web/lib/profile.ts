import type { SearchProfileInput } from "@chezy/contract";
import { eq } from "drizzle-orm";

import { db } from "~/lib/db/client";
import { type SearchProfile, searchProfile, user } from "~/lib/db/schema";
import { mergeUserProfile } from "~/lib/user-profile";

type ProfileDatabase = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export async function getProfile(userId: string): Promise<SearchProfile | undefined> {
  const rows = await db.select().from(searchProfile).where(eq(searchProfile.userId, userId));
  return rows[0];
}

export async function upsertProfile(
  userId: string,
  input: SearchProfileInput & { workLat?: number; workLon?: number },
  connection: ProfileDatabase = db,
): Promise<SearchProfile> {
  const { workLat, workLon, ...fields } = input;
  const values = {
    userId,
    // null clears the column on conflict-update; undefined would leave it stale.
    // oxlint-disable-next-line unicorn/no-null
    workLat: workLat ?? null,
    // oxlint-disable-next-line unicorn/no-null
    workLon: workLon ?? null,
    ...fields,
  };
  const now = new Date();
  const [row] = await connection
    .insert(searchProfile)
    .values(values)
    .onConflictDoUpdate({
      target: searchProfile.userId,
      set: { ...values, updatedAt: now },
    })
    .returning();

  // Coarse one-way mirror into User.profile so the chat onboarding reads
  // the same preferences. mergeUserProfile preserves freeformRequirements.
  const [existingUser] = await connection
    .select({ profile: user.profile })
    .from(user)
    .where(eq(user.id, userId));
  if (existingUser) {
    // mergeUserProfile strips onboardedAt from patches, set it like the
    // saveUserProfile tool does.
    const merged = mergeUserProfile(existingUser.profile ?? {}, {
      areas: input.neighbourhoods,
      budgetMinEur: input.minPriceEur,
      budgetMaxEur: input.maxPriceEur,
      bedroomsMin: input.minRooms,
      workLocation: input.workAddress,
    });
    merged.onboardedAt = now.toISOString();
    await connection
      .update(user)
      .set({ profile: merged, updatedAt: now })
      .where(eq(user.id, userId));
  }
  return row;
}

export async function resetProfile(userId: string, connection: ProfileDatabase): Promise<void> {
  await connection.delete(searchProfile).where(eq(searchProfile.userId, userId));
  await connection
    .update(user)
    // oxlint-disable-next-line unicorn/no-null
    .set({ profile: null, updatedAt: new Date() })
    .where(eq(user.id, userId));
}

export async function markVerified(userId: string): Promise<void> {
  await db
    .update(searchProfile)
    .set({ verified: true, updatedAt: new Date() })
    .where(eq(searchProfile.userId, userId));
}
