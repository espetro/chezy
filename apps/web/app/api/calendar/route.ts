// The SLNG `book_viewing` tool calls this endpoint (an API Request tool
// pointed at APP_BASE_URL + /api/calendar). `mock` is the demo default;
// `google` writes a real event with a service account.
// Booking logic lives in ~/lib/calendar (shared with the arrangeViewing tool).
import { BookingRequestSchema } from "@chezy/contract";
import * as v from "valibot";

import { bookViewing } from "~/lib/calendar";
import { markLatestViewingBooked } from "~/lib/db/queries";

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

  const view = await bookViewing(input);

  // The SLNG `book_viewing` webhook resolves the pending viewing for this
  // property; ignore misses (chat-initiated bookings update the row directly).
  if (view.status === "booked") {
    await markLatestViewingBooked({ listingId: input.propertyRef }).catch(() => undefined);
  }

  return Response.json(view, { status: view.status === "failed" ? 502 : 200 });
}
