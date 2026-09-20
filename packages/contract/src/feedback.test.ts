import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { FeedbackInputSchema, FeedbackUndoInputSchema, FEEDBACK_REASONS } from "./feedback";

const input = {
  eventId: "550e8400-e29b-41d4-a716-446655440000",
  listingId: "fotocasa:123",
  reason: "missing_balcony",
};

describe("feedback boundary", () => {
  it.each(FEEDBACK_REASONS)("accepts the bounded reason %s", (reason) => {
    expect(v.safeParse(FeedbackInputSchema, { ...input, reason }).success).toBe(true);
  });
  it.each([
    { reason: "bogus" },
    { eventId: "not-an-id" },
    { listingId: "" },
    { userId: "spoofed" },
    { profileVersion: "spoofed" },
    { facts: { amenities: ["balcony"] } },
  ])("rejects malformed or client-authored metadata: %j", (override) => {
    expect(v.safeParse(FeedbackInputSchema, { ...input, ...override }).success).toBe(false);
  });
  it("undo permits only an event identity", () => {
    expect(v.safeParse(FeedbackUndoInputSchema, { eventId: input.eventId }).success).toBe(true);
    expect(v.safeParse(FeedbackUndoInputSchema, input).success).toBe(false);
  });
});
