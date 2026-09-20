import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";
import * as v from "valibot";

import { bookViewing } from "~/lib/calendar";
import { getUserByUsername, insertViewing } from "~/lib/db/queries";
import { getListingById } from "~/lib/listings";
import { normalizeUsername } from "~/lib/user-profile";
import { dispatchViewing } from "~/lib/viewing";

export const arrangeViewing = tool({
  description:
    "Arrange a viewing for a listing: phones the agency (mock/slng/vonage per VIEWING_MODE) and books the slot on the calendar (mock/google per CALENDAR_MODE), then persists a Viewing row. Only call this after the user has agreed to a visit or explicitly asked for one (e.g. 'book a visit for the top one'). Returns { listing, viewing, booking, viewingId } — the UI renders it as a ViewingCard, so confirm the time in one sentence only.",
  inputSchema: valibotSchema(
    v.object({
      username: v.string(),
      listingId: v.string(),
      slotHint: v.optional(v.string()),
    }),
  ),
  execute: async (input) => {
    const username = normalizeUsername(input.username);
    if (!username) {
      return { error: "invalid username" };
    }
    const user = await getUserByUsername(username);
    if (!user) {
      return { error: "unknown user — call identifyUser first" };
    }

    const listing = await getListingById(input.listingId);
    if (!listing) {
      return { error: `listing ${input.listingId} not found` };
    }

    const viewing = await dispatchViewing({
      propertyRef: input.listingId,
      slotHint: input.slotHint,
    });

    if (viewing.status === "failed") {
      const row = await insertViewing({
        userId: user.id,
        listingId: input.listingId,
        channel: viewing.channel,
        status: "failed",
        callId: viewing.callId,
        slotIso: viewing.slotIso,
      });
      return { listing, viewing, booking: undefined, viewingId: row.id };
    }

    const booking = viewing.slotIso
      ? await bookViewing({ propertyRef: input.listingId, slotIso: viewing.slotIso })
      : undefined;

    const status = booking?.status === "booked" ? "booked" : viewing.status;
    const row = await insertViewing({
      userId: user.id,
      listingId: input.listingId,
      channel: viewing.channel,
      status,
      callId: viewing.callId,
      slotIso: booking?.slotIso ?? viewing.slotIso,
    });

    return { listing, viewing, booking, viewingId: row.id };
  },
});
