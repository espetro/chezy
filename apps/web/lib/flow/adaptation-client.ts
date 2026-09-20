"use client";

import { AdaptationOutputSchema, type AdaptationJob } from "@chezy/contract";
import * as v from "valibot";

// Fire-and-forget panel request after a rejection; every failure (offline,
// 4xx/5xx, schema mismatch) resolves to undefined so the feed stays usable.
export const requestAdaptation = async (eventId: string): Promise<AdaptationJob | undefined> => {
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
