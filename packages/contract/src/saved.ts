import * as v from "valibot";

// Heart on a candidate card: a per-session bookmark with no ranking effect.
export const SavedInputSchema = v.strictObject({
  listingId: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  saved: v.boolean(),
});
export type SavedInput = v.InferOutput<typeof SavedInputSchema>;

export const SavedOutputSchema = v.strictObject({ listingId: v.string(), saved: v.boolean() });
export type SavedOutput = v.InferOutput<typeof SavedOutputSchema>;

export const SavedListOutputSchema = v.strictObject({ listingIds: v.array(v.string()) });
export type SavedListOutput = v.InferOutput<typeof SavedListOutputSchema>;
