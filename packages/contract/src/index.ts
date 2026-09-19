import * as v from "valibot";

/**
 * Wire types shared between the web app and any future Python/agent caller.
 * Valibot is the runtime validator everywhere in the TS workspace (Zod is
 * banned by .oxlintrc.json).
 */

export const ViewingRequestSchema = v.object({
  propertyRef: v.pipe(v.string(), v.minLength(1)),
  agencyPhone: v.pipe(v.string(), v.regex(/^\+?[0-9]{6,15}$/)),
  slotHint: v.optional(v.string()),
});

export type ViewingRequest = v.InferOutput<typeof ViewingRequestSchema>;

export const ViewingResultSchema = v.object({
  status: v.picklist(["mock", "dispatched", "failed"]),
  channel: v.picklist(["mock", "slng", "vonage"]),
  callId: v.optional(v.string()),
  slotIso: v.optional(v.string()),
  detail: v.optional(v.string()),
});

export type ViewingResult = v.InferOutput<typeof ViewingResultSchema>;

export const BookingRequestSchema = v.object({
  propertyRef: v.pipe(v.string(), v.minLength(1)),
  slotIso: v.pipe(v.string(), v.isoDateTime()),
  durationMinutes: v.fallback(
    v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(240)),
    30,
  ),
  summary: v.optional(v.string()),
  description: v.optional(v.string()),
});

export type BookingRequest = v.InferOutput<typeof BookingRequestSchema>;

export const BookingResultSchema = v.object({
  status: v.picklist(["booked", "failed"]),
  channel: v.picklist(["mock", "google"]),
  slotIso: v.string(),
  eventId: v.optional(v.string()),
  detail: v.optional(v.string()),
});

export type BookingResult = v.InferOutput<typeof BookingResultSchema>;
