// Public surface of @chezy/contract: Valibot schemas shared between apps/web,
// packages/db and apps/scraper (pydantic side lives in apps/scraper models.py).
export * from "./listings";

import * as v from "valibot";

/**
 * Wire types shared between the web app and any future Python/agent caller.
 * Valibot is the runtime validator everywhere in the TS workspace (Zod is
 * banned by .oxlintrc.json).
 */

export const ViewingRequestSchema = v.object({
  propertyRef: v.pipe(v.string(), v.minLength(1)),
  agencyPhone: v.optional(v.pipe(v.string(), v.regex(/^\+?[0-9]{6,15}$/))),
  slotHint: v.optional(v.string()),
  live: v.optional(v.boolean(), false),
  requestId: v.optional(v.pipe(v.string(), v.uuid())),
  retry: v.optional(v.boolean(), false),
});

export type ViewingRequest = v.InferOutput<typeof ViewingRequestSchema>;

const ViewingSlotSchema = v.pipe(
  v.string(),
  v.isoTimestamp(),
  v.check((slot) => Number.isFinite(Date.parse(slot)) && new Date(slot).toISOString() === slot),
);

export const ViewingResultSchema = v.variant("status", [
  v.object({
    status: v.literal("mock"),
    channel: v.literal("mock"),
    slotIso: ViewingSlotSchema,
    detail: v.optional(v.string()),
  }),
  v.object({
    status: v.literal("dispatched"),
    channel: v.picklist(["slng", "vonage"]),
    callId: v.pipe(v.string(), v.regex(/^redacted:[a-f0-9]{12}$/)),
    slotIso: v.optional(v.never()),
    requestedAt: ViewingSlotSchema,
    dispatchedAt: ViewingSlotSchema,
    latencyMs: v.pipe(v.number(), v.integer(), v.minValue(0)),
    detail: v.optional(v.string()),
  }),
  v.object({
    status: v.literal("failed"),
    channel: v.picklist(["mock", "slng", "vonage"]),
    retryable: v.boolean(),
    detail: v.string(),
  }),
]);

export type ViewingResult = v.InferOutput<typeof ViewingResultSchema>;

export const BookingRequestSchema = v.object({
  propertyRef: v.pipe(v.string(), v.minLength(1)),
  slotIso: v.pipe(v.string(), v.isoTimestamp()),
  durationMinutes: v.fallback(v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(240)), 30),
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

export * from "./user";
export * from "./profile";
export * from "./feedback";
export * from "./adaptation";
