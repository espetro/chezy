// Viewing dispatch shared by the arrangeViewing chat tool. `mock` places no
// call and returns a synthetic slot; `slng`/`vonage` place a real outbound
// call. Distinct from ~/lib/viewing (the client-side controller for the flow
// UI) and from POST /api/viewing (the live opt-in endpoint).
import { createHash } from "node:crypto";

import type { ViewingResult } from "@chezy/contract";
import { getLogger } from "@chezy/observability";

import { nextSlotIso } from "~/lib/calendar";
import { env } from "~/lib/env";
import { getListingInsights, insightsToCallVariables } from "~/lib/insights";
import { getListingById, listingToCallVariables } from "~/lib/listings";
import { dispatchSlngCall } from "~/lib/slng";
import { placeVonageCall } from "~/lib/vonage";

const logger = getLogger(["chezy", "viewing"]);

export interface DispatchViewingInput {
  readonly propertyRef: string;
  readonly agencyPhone?: string;
  readonly slotHint?: string;
}

const redactCallId = (callId: string): string =>
  `redacted:${createHash("sha256").update(callId).digest("hex").slice(0, 12)}`;

export const dispatchViewing = async (input: DispatchViewingInput): Promise<ViewingResult> => {
  // Mock never dials, so it needs no callee.
  if (env.VIEWING_MODE === "mock") {
    return {
      status: "mock",
      channel: "mock",
      slotIso: nextSlotIso(input.slotHint),
      detail: "mock viewing (VIEWING_MODE=mock)",
    };
  }

  const to = input.agencyPhone ?? env.DEMO_AGENCY_PHONE;
  if (!to) {
    return {
      status: "failed",
      channel: env.VIEWING_MODE,
      retryable: true,
      detail: "no callee: pass agencyPhone or set DEMO_AGENCY_PHONE",
    };
  }

  const requestedAt = new Date().toISOString();
  const started = performance.now();
  try {
    if (env.VIEWING_MODE === "slng") {
      const summary = await getListingById(input.propertyRef);
      // Stored insights only — extraction never runs on the call path.
      const insights = await getListingInsights(input.propertyRef);
      const result = await dispatchSlngCall({
        to,
        variables: summary
          ? {
              ...listingToCallVariables(summary),
              ...(insights ? insightsToCallVariables(insights) : {}),
            }
          : { property_ref: input.propertyRef },
      });
      return {
        status: "dispatched",
        channel: "slng",
        callId: redactCallId(result.callId),
        requestedAt,
        dispatchedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - started),
        detail: result.detail,
      };
    }

    if (env.VIEWING_MODE === "vonage") {
      const result = await placeVonageCall({
        to,
        ncco: [
          {
            action: "talk",
            text: "Hola, llamo por el piso. Quisiera reservar una visita.",
            language: "es-ES",
          },
        ],
      });
      return {
        status: "dispatched",
        channel: "vonage",
        callId: redactCallId(result.uuid),
        requestedAt,
        dispatchedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - started),
        detail: result.status,
      };
    }

    return {
      status: "failed",
      channel: env.VIEWING_MODE,
      retryable: false,
      detail: `unknown VIEWING_MODE ${env.VIEWING_MODE}`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    logger.error("viewing dispatch failed ({channel}): {detail}", {
      channel: env.VIEWING_MODE,
      detail,
      propertyRef: input.propertyRef,
    });
    return {
      status: "failed",
      channel: env.VIEWING_MODE,
      retryable: true,
      detail,
    };
  }
};
