// Triggered when a user likes a listing. In `mock` mode it books a slot
// locally; in `slng` mode the SLNG agent places the outbound call; in
// `vonage` mode Vonage places the call and plays a short line.
import { ViewingRequestSchema, type ViewingResult } from "@chezy/contract";
import * as v from "valibot";

import { nextSlotIso } from "@/lib/calendar";
import { env } from "@/lib/env";
import { dispatchSlngCall } from "@/lib/slng";
import { placeVonageCall } from "@/lib/vonage";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = v.safeParse(ViewingRequestSchema, body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid viewing request", issues: parsed.issues },
      { status: 400 },
    );
  }
  const input = parsed.output;

  try {
    if (env.VIEWING_MODE === "slng") {
      const result = await dispatchSlngCall({
        to: input.agencyPhone,
        variables: { property_ref: input.propertyRef },
      });
      const view: ViewingResult = {
        status: "dispatched",
        channel: "slng",
        callId: result.callId,
        slotIso: nextSlotIso(input.slotHint),
        detail: result.detail,
      };
      return Response.json(view);
    }

    if (env.VIEWING_MODE === "vonage") {
      const result = await placeVonageCall({
        to: input.agencyPhone,
        ncco: [
          {
            action: "talk",
            text: "Hola, llamo por el piso. Quisiera reservar una visita.",
            language: "es-ES",
          },
        ],
      });
      const view: ViewingResult = {
        status: "dispatched",
        channel: "vonage",
        callId: result.uuid,
        slotIso: nextSlotIso(input.slotHint),
        detail: result.status,
      };
      return Response.json(view);
    }

    const view: ViewingResult = {
      status: "mock",
      channel: "mock",
      slotIso: nextSlotIso(input.slotHint),
      detail: "mock viewing (VIEWING_MODE=mock)",
    };
    return Response.json(view);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    const view: ViewingResult = {
      status: "failed",
      channel: env.VIEWING_MODE,
      detail,
    };
    return Response.json(view, { status: 502 });
  }
}
