"use client";

import {
  AdaptationOutputSchema,
  isAdaptationFocus,
  type AdaptationJob,
  type FeedbackEvent,
} from "@chezy/contract";
import * as v from "valibot";

// Fire-and-forget panel request after a rejection; every failure (offline,
// 4xx/5xx, schema mismatch) resolves to undefined so the feed stays usable.
// A free-form rejection has nothing to compare around, so no request is sent
// until it is refined to a structured reason.
export const requestAdaptation = async ({
  eventId,
  reason,
}: FeedbackEvent): Promise<AdaptationJob | undefined> => {
  if (!isAdaptationFocus(reason)) return undefined;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/adaptation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status !== 202) return undefined;
    return v.parse(AdaptationOutputSchema, await response.json()).job;
  } catch {
    return undefined;
  }
};
