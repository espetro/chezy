import * as v from "valibot";

export const FEEDBACK_REASONS = [
  "too_expensive",
  "wrong_area",
  "missing_balcony",
  "other",
] as const;
export const FeedbackReasonSchema = v.picklist(FEEDBACK_REASONS);
export type FeedbackReason = v.InferOutput<typeof FeedbackReasonSchema>;

export const ProfileVersionSchema = v.pipe(v.string(), v.regex(/^sha256:[a-f0-9]{64}$/));
export type ProfileVersion = v.InferOutput<typeof ProfileVersionSchema>;

export const FeedbackInputSchema = v.strictObject({
  eventId: v.pipe(v.string(), v.uuid()),
  listingId: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  reason: FeedbackReasonSchema,
});
export type FeedbackInput = v.InferOutput<typeof FeedbackInputSchema>;

export const FeedbackUndoInputSchema = v.strictObject({
  eventId: v.pipe(v.string(), v.uuid()),
});
export type FeedbackUndoInput = v.InferOutput<typeof FeedbackUndoInputSchema>;

// Swap the reason on an active rejection (the card-level "other" refined into a
// specific one the rerank understands).
export const FeedbackRefineInputSchema = v.strictObject({
  eventId: v.pipe(v.string(), v.uuid()),
  reason: FeedbackReasonSchema,
});
export type FeedbackRefineInput = v.InferOutput<typeof FeedbackRefineInputSchema>;

export const FeedbackEventSchema = v.strictObject({
  schemaVersion: v.literal(1),
  type: v.literal("listing.rejected"),
  eventId: v.pipe(v.string(), v.uuid()),
  userId: v.pipe(v.string(), v.uuid()),
  listingId: v.string(),
  reason: FeedbackReasonSchema,
  profileVersion: ProfileVersionSchema,
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  undoneAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  facts: v.strictObject({
    priceEur: v.nullable(v.number()),
    neighbourhood: v.nullable(v.string()),
    amenities: v.array(v.string()),
  }),
});
export type FeedbackEvent = v.InferOutput<typeof FeedbackEventSchema>;

export const FeedbackOutputSchema = v.strictObject({ event: FeedbackEventSchema });
export const FeedbackListOutputSchema = v.strictObject({ events: v.array(FeedbackEventSchema) });
export type FeedbackOutput = v.InferOutput<typeof FeedbackOutputSchema>;
export type FeedbackListOutput = v.InferOutput<typeof FeedbackListOutputSchema>;

export const listingFeedbackInputSchema = v.object({
  username: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  listingId: v.string(),
  verdict: v.picklist(["accepted", "rejected"]),
  reason: v.optional(v.string()),
});

export type ListingFeedbackInput = v.InferOutput<typeof listingFeedbackInputSchema>;
