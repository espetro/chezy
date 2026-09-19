// The SLNG `book_viewing` tool calls this endpoint (an API Request tool
// pointed at APP_BASE_URL + /api/calendar). `mock` is the demo default;
// `google` writes a real event with a service account.
import { BookingRequestSchema, type BookingResult } from "@chezy/contract";
import { getLogger } from "@chezy/observability";
import * as v from "valibot";

import { createGoogleEvent, mockBooking } from "~/lib/calendar";
import { env } from "~/lib/env";

const logger = getLogger(["chezy", "calendar"]);

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = v.safeParse(BookingRequestSchema, body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid booking request", issues: parsed.issues },
      { status: 400 },
    );
  }
  const input = parsed.output;

  try {
    if (env.CALENDAR_MODE === "google") {
      const event = await createGoogleEvent({
        propertyRef: input.propertyRef,
        slotIso: input.slotIso,
        durationMinutes: input.durationMinutes,
        summary: input.summary ?? `Property viewing: ${input.propertyRef}`,
        description:
          input.description ?? `Booked by the chezy voice agent for ${input.propertyRef}.`,
      });
      const view: BookingResult = {
        status: event.status,
        channel: event.channel,
        slotIso: event.slotIso,
        ...(event.eventId ? { eventId: event.eventId } : {}),
      };
      return Response.json(view);
    }

    const event = mockBooking(input.slotIso);
    const view: BookingResult = {
      status: event.status,
      channel: event.channel,
      slotIso: event.slotIso,
      detail: event.detail,
    };
    return Response.json(view);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    logger.error("calendar booking failed ({channel}): {detail}", {
      channel: env.CALENDAR_MODE,
      detail,
      propertyRef: input.propertyRef,
    });
    const view: BookingResult = {
      status: "failed",
      channel: env.CALENDAR_MODE,
      slotIso: input.slotIso,
      detail,
    };
    return Response.json(view, { status: 502 });
  }
}
