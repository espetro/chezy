import { listingFeedbackInputSchema } from "@chezy/contract";
import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";

import { getUserByUsername, updateUserProfile } from "~/lib/db/queries";
import { getListingRowById } from "~/lib/listings";
import {
  inferPreferencePatch,
  mergeUserProfile,
  normalizeUsername,
} from "~/lib/user-profile";

export const recordListingFeedback = tool({
  description:
    "Record the user's verdict on a listing card. Call this whenever the user accepts or rejects a listing (the UI sends 'Accepted listing <id>' / 'Rejected listing <id>: <reason>'). On a rejection it stores the id in rejectedListingIds and, when the reason maps to a known preference (price, area, size, elevator, balcony, interior/light, furnished, pets), patches the profile so the next searchListings call reflects it. Returns { verdict, listingId, patch, profile } — acknowledge the applied `patch` in one line.",
  inputSchema: valibotSchema(listingFeedbackInputSchema),
  execute: async (input) => {
    const username = normalizeUsername(input.username);
    if (!username) {
      return { error: "invalid username" };
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return { error: "unknown user — call identifyUser first" };
    }

    const profile = user.profile ?? {};
    const patch =
      input.verdict === "rejected"
        ? inferPreferencePatch(
            input.reason,
            (await getListingRowById(input.listingId)) ?? {
              priceEur: null,
              neighbourhood: null,
              district: null,
              builtM2: null,
            },
            profile,
          )
        : {};

    const merged = mergeUserProfile(profile, patch);
    if (input.verdict === "rejected") {
      merged.rejectedListingIds = [
        ...new Set([...(merged.rejectedListingIds ?? []), input.listingId]),
      ];
    }

    await updateUserProfile({ userId: user.id, profile: merged });

    return {
      verdict: input.verdict,
      listingId: input.listingId,
      patch,
      profile: merged,
    };
  },
});
