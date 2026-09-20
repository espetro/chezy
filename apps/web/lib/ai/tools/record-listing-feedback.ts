import { randomUUID } from "node:crypto";

import { listingFeedbackInputSchema } from "@chezy/contract";
import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";

import { getUserByUsername, updateUserProfile } from "~/lib/db/queries";
import { FeedbackError, recordFeedback } from "~/lib/feedback";
import { describeFeedback } from "~/lib/feedback-ranking";
import { getListingRowById } from "~/lib/listings";
import { getProfile } from "~/lib/profile";
import {
  inferPreferencePatch,
  mapRejectionReason,
  mergeUserProfile,
  scopedUsername,
} from "~/lib/user-profile";
import { syncSearchProfile } from "~/lib/user-profile-sync";

export const recordListingFeedback = ({ sessionUserId }: { sessionUserId: string }) =>
  tool({
    description:
      "Record the user's verdict on a listing card. Call this whenever the user accepts or rejects a listing (the UI sends 'Accepted listing <id>' / 'Rejected listing <id>: <reason>'). On a rejection it writes a JES-8 event into listing_feedback via recordFeedback — the free-text reason maps to FEEDBACK_REASONS (too_expensive, wrong_area, missing_balcony, other) — and, separately, may patch the profile when the reason maps to a known preference (price, area, size, elevator, balcony, interior/light, furnished, pets). Accepted verdicts record nothing. Returns { verdict, listingId, reason, eventId, explanation, patch, profile } — acknowledge the applied `patch` or `explanation` in one line.",
    inputSchema: valibotSchema(listingFeedbackInputSchema),
    execute: async (input) => {
      const username = scopedUsername(sessionUserId, input.username);
      if (!username) {
        return { error: "invalid username" };
      }

      const user = await getUserByUsername(username);
      if (!user) {
        return { error: "unknown user — call identifyUser first" };
      }

      // recordFeedback requires a SearchProfile row; write through from the
      // chat scratchpad when it is complete but not yet mirrored.
      const searchProfile =
        (await getProfile(user.id)) ?? (await syncSearchProfile(user.id, user.profile ?? {}));
      if (!searchProfile) {
        return { error: "onboarding incomplete" };
      }

      const profile = user.profile ?? {};

      if (input.verdict === "rejected") {
        let event;
        try {
          event = await recordFeedback(user.id, {
            eventId: randomUUID(),
            listingId: input.listingId,
            reason: mapRejectionReason(input.reason),
          });
        } catch (error) {
          if (error instanceof FeedbackError) {
            return { error: error.message };
          }
          throw error;
        }

        const listingRow = (await getListingRowById(input.listingId)) ?? {
          // oxlint-disable-next-line unicorn/no-null
          priceEur: null,
          // oxlint-disable-next-line unicorn/no-null
          neighbourhood: null,
          // oxlint-disable-next-line unicorn/no-null
          district: null,
          // oxlint-disable-next-line unicorn/no-null
          builtM2: null,
        };
        const patch = inferPreferencePatch(input.reason, listingRow, profile);
        let merged = profile;
        if (Object.keys(patch).length > 0) {
          merged = mergeUserProfile(profile, patch);
          await updateUserProfile({ userId: user.id, profile: merged });
          await syncSearchProfile(user.id, merged);
        }

        return {
          verdict: input.verdict,
          listingId: input.listingId,
          reason: event.reason,
          eventId: event.eventId,
          explanation: describeFeedback(event),
          patch,
          profile: merged,
        };
      }

      return {
        verdict: input.verdict,
        listingId: input.listingId,
        reason: undefined,
        eventId: undefined,
        explanation: undefined,
        patch: {},
        profile,
      };
    },
  });
