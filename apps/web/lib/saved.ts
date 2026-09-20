import { and, asc, eq } from "drizzle-orm";
import { db } from "~/lib/db/client";
import { listing, listingSave } from "~/lib/db/schema";
import type { DemoUserCleanup } from "~/lib/demo/reset";

export class SavedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const listSavedListingIds = async (userId: string): Promise<string[]> => {
  const rows = await db
    .select({ listingId: listingSave.listingId })
    .from(listingSave)
    .where(eq(listingSave.userId, userId))
    .orderBy(asc(listingSave.createdAt));
  return rows.map((row) => row.listingId);
};

// Idempotent: saving twice or removing a missing save both settle on `saved`.
export const setSaved = async (userId: string, listingId: string, saved: boolean) => {
  if (!saved) {
    await db
      .delete(listingSave)
      .where(and(eq(listingSave.userId, userId), eq(listingSave.listingId, listingId)));
    return false;
  }
  const [home] = await db.select({ id: listing.id }).from(listing).where(eq(listing.id, listingId));
  if (!home) throw new SavedError("Listing not found", 404);
  await db.insert(listingSave).values({ userId, listingId }).onConflictDoNothing();
  return true;
};

export const clearUserSaves: DemoUserCleanup = async (transaction, userId) => {
  await transaction.delete(listingSave).where(eq(listingSave.userId, userId));
};
