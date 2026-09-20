// `arrangeViewing` — there is no apps/web AI SDK tool for viewing dispatch
// (the webapp exposes it as POST /api/viewing), so this Mastra tool wraps the
// shared `dispatchViewing` from `~/lib/viewing-call` and records every dispatch
// in `bot.viewings`. Approval-gated: the model proposes, Telegram shows an
// approve/deny card, and only approval executes the call.
import { createTool } from "@mastra/core/tools";
import type { ViewingResult } from "@chezy/contract";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

import { client } from "~/lib/db/client";
import { dispatchViewing as dispatchViewingCall } from "~/lib/viewing-call";

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
  const view = await dispatchViewingCall(input);

  await client.unsafe(
    `INSERT INTO bot.viewings (username, property_ref, status, channel, call_id, slot_iso, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      username,
      input.propertyRef,
      view.status,
      view.channel,
      "callId" in view ? view.callId : null,
      "slotIso" in view ? (view.slotIso ?? null) : null,
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
