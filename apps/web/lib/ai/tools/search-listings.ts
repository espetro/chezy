import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";
import * as v from "valibot";

import { AUTO_CALL_MATCH_THRESHOLD } from "~/lib/constants";
import { getUserByUsername } from "~/lib/db/queries";
import type { SearchProfile } from "~/lib/db/schema";
import { buildFeed } from "~/lib/feed";
import { listActiveFeedback } from "~/lib/feedback";
import { listRentCandidates, toListingSummary, type ListingSummary } from "~/lib/listings";
import { getProfile } from "~/lib/profile";
import { missingProfileFields, scopedUsername } from "~/lib/user-profile";
import { syncSearchProfile } from "~/lib/user-profile-sync";

export interface ScoredListingSummary extends ListingSummary {
  readonly score: number;
  readonly reasons: string[];
}

export const searchListingsTool = ({ sessionUserId }: { sessionUserId: string }) =>
  tool({
    description:
      "Search Barcelona rental listings scored against the named user's saved profile. Call it ONCE per search turn — it relaxes constraints itself and reports what it relaxed in `relaxed`/`note`, so never retry. Returns { listings, total, relaxed, note, topMatches }: each listing carries `score` (0-100) and `reasons`; `topMatches` lists the ids at or above the auto-call bar. Pass `query` only for a specific neighbourhood/district name (e.g. 'Gràcia', 'Eixample'), never city names or English words. Requires the user's username; returns { error, missingFields } when onboarding is incomplete.",
    inputSchema: valibotSchema(
      v.object({
        username: v.string(),
        query: v.optional(v.string()),
        maxPriceEur: v.optional(v.number()),
        minRooms: v.optional(v.number()),
      }),
    ),
    execute: async (input) => {
      const username = scopedUsername(sessionUserId, input.username);
      if (!username) {
        return { error: "invalid username" };
      }

      const user = await getUserByUsername(username);
      if (!user) {
        return { error: "onboarding incomplete", missingFields: missingProfileFields({}) };
      }

      // SearchProfile is the matching store; write through from the chat
      // scratchpad (User.profile) when it is complete but not yet mirrored.
      const stored =
        (await getProfile(user.id)) ?? (await syncSearchProfile(user.id, user.profile ?? {}));
      if (!stored) {
        return {
          error: "onboarding incomplete",
          missingFields: missingProfileFields(user.profile ?? {}),
        };
      }

      const profile: SearchProfile = { ...stored };
      if (input.maxPriceEur !== undefined) {
        profile.maxPriceEur = input.maxPriceEur;
      }
      if (input.minRooms !== undefined) {
        profile.minRooms = input.minRooms;
      }
      if (input.query) {
        profile.neighbourhoods = [input.query];
      }

      // JES-8 feedback events: rankListings excludes rejected listings and
      // applies feedbackBoost; no separate rejected-id store exists.
      const events = await listActiveFeedback(user.id);
      const feed = await buildFeed(profile, listRentCandidates, 8, events);

      const listings: ScoredListingSummary[] = feed.items.slice(0, 6).map((item) => ({
        ...toListingSummary(item.listing),
        score: item.match.score,
        reasons: item.match.reasons,
      }));
      const topMatches = listings
        .filter((l) => l.score >= AUTO_CALL_MATCH_THRESHOLD)
        .map((l) => l.id);

      return {
        listings,
        total: feed.items.length,
        relaxed: feed.relaxed,
        note: feed.note,
        topMatches,
      };
    },
  });
