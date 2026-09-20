import { FeedbackEventSchema, type FeedbackInput } from "@chezy/contract";
import { and, asc, eq, isNull } from "drizzle-orm";
import * as v from "valibot";
import { db } from "~/lib/db/client";
import {
  listing,
  listingFeedback,
  searchProfile,
  user,
  type ListingFeedback,
} from "~/lib/db/schema";
import type { DemoUserCleanup } from "~/lib/demo/reset";
import { getProfileVersion } from "~/lib/profile-version";

export class FeedbackError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const toFeedbackEvent = (row: ListingFeedback) =>
  v.parse(FeedbackEventSchema, {
    schemaVersion: 1,
    type: "listing.rejected",
    eventId: row.eventId,
    userId: row.userId,
    listingId: row.listingId,
    reason: row.reason,
    profileVersion: row.profileVersion,
    createdAt: row.createdAt.toISOString(),
    undoneAt: row.undoneAt ? row.undoneAt.toISOString() : row.undoneAt,
    facts: row.facts,
  });

export const listActiveFeedback = async (userId: string) => {
  const rows = await db
    .select()
    .from(listingFeedback)
    .where(and(eq(listingFeedback.userId, userId), isNull(listingFeedback.undoneAt)))
    .orderBy(asc(listingFeedback.createdAt), asc(listingFeedback.eventId));
  return rows.map(toFeedbackEvent);
};

export const getFeedbackEvent = async (userId: string, eventId: string) => {
  const [row] = await db
    .select()
    .from(listingFeedback)
    .where(and(eq(listingFeedback.userId, userId), eq(listingFeedback.eventId, eventId)));
  return row ? toFeedbackEvent(row) : undefined;
};

export const recordFeedback = async (userId: string, input: FeedbackInput) =>
  db.transaction(async (transaction) => {
    const [identity] = await transaction
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!identity) throw new FeedbackError("Session no longer exists", 401);

    const [existing] = await transaction
      .select()
      .from(listingFeedback)
      .where(and(eq(listingFeedback.userId, userId), eq(listingFeedback.eventId, input.eventId)));
    if (existing) {
      if (existing.listingId !== input.listingId || existing.reason !== input.reason) {
        throw new FeedbackError("Event ID already used for different feedback", 409);
      }
      return toFeedbackEvent(existing);
    }
    const [active] = await transaction
      .select()
      .from(listingFeedback)
      .where(
        and(
          eq(listingFeedback.userId, userId),
          eq(listingFeedback.listingId, input.listingId),
          isNull(listingFeedback.undoneAt),
        ),
      );
    if (active) return toFeedbackEvent(active);

    const [profile] = await transaction
      .select()
      .from(searchProfile)
      .where(eq(searchProfile.userId, userId));
    if (!profile) throw new FeedbackError("Set your preferences first", 409);
    const [home] = await transaction.select().from(listing).where(eq(listing.id, input.listingId));
    if (!home) throw new FeedbackError("Listing not found", 404);

    const [row] = await transaction
      .insert(listingFeedback)
      .values({
        ...input,
        userId,
        profileVersion: getProfileVersion(profile),
        facts: {
          priceEur: home.priceEur,
          neighbourhood: home.neighbourhood,
          amenities: home.amenities,
        },
      })
      .returning();
    return toFeedbackEvent(row);
  });

export const undoFeedback = async (userId: string, eventId: string) =>
  db.transaction(async (transaction) => {
    await transaction.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    const [existing] = await transaction
      .select()
      .from(listingFeedback)
      .where(and(eq(listingFeedback.userId, userId), eq(listingFeedback.eventId, eventId)));
    if (!existing) throw new FeedbackError("Feedback not found", 404);
    if (existing.undoneAt) return toFeedbackEvent(existing);
    const now = new Date();
    const [row] = await transaction
      .update(listingFeedback)
      .set({ undoneAt: now, updatedAt: now })
      .where(and(eq(listingFeedback.userId, userId), eq(listingFeedback.eventId, eventId)))
      .returning();
    return toFeedbackEvent(row);
  });

export const clearUserFeedback: DemoUserCleanup = async (transaction, userId) => {
  await transaction.delete(listingFeedback).where(eq(listingFeedback.userId, userId));
};
