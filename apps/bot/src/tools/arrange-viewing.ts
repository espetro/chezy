// `arrangeViewing` — there is no apps/web AI SDK tool for viewing dispatch
// (the webapp exposes it as POST /api/viewing), so this Mastra tool mirrors the
// route's logic against the same lib functions and records every dispatch in
// `bot.viewings`. Approval-gated: the model proposes, Telegram shows an
// approve/deny card, and only approval executes the call.
import { createTool } from "@mastra/core/tools";
import type { ViewingResult } from "@chezy/contract";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

import { nextSlotIso } from "~/lib/calendar";
import { client } from "~/lib/db/client";
import { env } from "~/lib/env";
import { getListingInsights, insightsToCallVariables } from "~/lib/insights";
import { getListingById, listingToCallVariables } from "~/lib/listings";
import { dispatchSlngCall } from "~/lib/slng";
import { placeVonageCall } from "~/lib/vonage";

import { usernameFromContext } from "./adapt";

export const arrangeViewingInput = v.object({
  propertyRef: v.pipe(
    v.string(),
    v.minLength(1),
    v.description("Listing id, e.g. one returned by searchListings"),
  ),
  agencyPhone: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^\+?[0-9]{6,15}$/),
      v.description("E.164-ish phone of the listing agency; omit to use the demo callee"),
    ),
  ),
  slotHint: v.optional(
    v.pipe(v.string(), v.description("Natural-language or ISO hint for the visit slot")),
  ),
});

export type ArrangeViewingInput = v.InferOutput<typeof arrangeViewingInput>;

export async function dispatchViewing(
  input: ArrangeViewingInput,
  username: string,
): Promise<ViewingResult> {
  const to = input.agencyPhone ?? env.DEMO_AGENCY_PHONE;

  let view: ViewingResult;
  try {
    if (env.VIEWING_MODE === "slng") {
      if (!to) throw new Error("no callee configured");
      const summary = await getListingById(input.propertyRef);
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
      view = {
        status: "dispatched",
        channel: "slng",
        callId: result.callId,
        slotIso: nextSlotIso(input.slotHint),
        detail: result.detail,
      };
    } else if (env.VIEWING_MODE === "vonage") {
      if (!to) throw new Error("no callee configured");
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
      view = {
        status: "dispatched",
        channel: "vonage",
        callId: result.uuid,
        slotIso: nextSlotIso(input.slotHint),
        detail: result.status,
      };
    } else {
      view = {
        status: "mock",
        channel: "mock",
        slotIso: nextSlotIso(input.slotHint),
        detail: "mock viewing (VIEWING_MODE=mock)",
      };
    }
  } catch (error) {
    view = {
      status: "failed",
      channel: env.VIEWING_MODE,
      detail: error instanceof Error ? error.message : "unknown error",
    };
  }

  await client.unsafe(
    `INSERT INTO bot.viewings (username, property_ref, status, channel, call_id, slot_iso, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      username,
      input.propertyRef,
      view.status,
      view.channel,
      view.callId ?? null,
      view.slotIso ?? null,
      view.detail ?? null,
    ],
  );

  return view;
}

export const arrangeViewing = createTool({
  id: "arrangeViewing",
  description:
    "Place a phone call to the listing's agency to book a viewing. Only call this when the user explicitly asks for a visit; it always requires their approval first.",
  inputSchema: toStandardJsonSchema(arrangeViewingInput),
  requireApproval: true,
  execute: async (input, ctx) => dispatchViewing(input, usernameFromContext(ctx.requestContext)),
});
