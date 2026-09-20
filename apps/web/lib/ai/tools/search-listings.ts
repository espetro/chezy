import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";
import * as v from "valibot";

import { AUTO_CALL_MATCH_THRESHOLD } from "~/lib/constants";
import { getUserByUsername } from "~/lib/db/queries";
import { buildFeed } from "~/lib/feed";
import { listRentCandidates, toListingSummary, type ListingSummary } from "~/lib/listings";
import { missingProfileFields, normalizeUsername, toScoringProfile } from "~/lib/user-profile";

export interface ScoredListingSummary extends ListingSummary {
  readonly score: number;
  readonly reasons: string[];
}

export const searchListingsTool = tool({
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
    const username = normalizeUsername(input.username);
    if (!username) {
      return { error: "invalid username" };
    }

    const user = await getUserByUsername(username);
    const profile = user?.profile ?? {};
    const missingFields = missingProfileFields(profile);
    if (missingFields.length > 0) {
      return { error: "onboarding incomplete", missingFields };
    }

    const scoringProfile = toScoringProfile(profile);
    if (input.maxPriceEur !== undefined) {
      scoringProfile.maxPriceEur = input.maxPriceEur;
    }
    if (input.minRooms !== undefined) {
      scoringProfile.minRooms = input.minRooms;
    }
    if (input.query) {
      scoringProfile.neighbourhoods = [input.query];
    }

    const feed = await buildFeed(scoringProfile, listRentCandidates);

    const rejected = new Set(profile.rejectedListingIds ?? []);
    const kept = feed.items.filter((item) => !rejected.has(item.listing.id));

    const listings: ScoredListingSummary[] = kept.slice(0, 6).map((item) => ({
      ...toListingSummary(item.listing),
      score: item.match.score,
      reasons: item.match.reasons,
    }));
    const topMatches = listings
      .filter((l) => l.score >= AUTO_CALL_MATCH_THRESHOLD)
      .map((l) => l.id);

    return {
      listings,
      total: kept.length,
      relaxed: feed.relaxed,
      note: feed.note,
      topMatches,
    };
  },
});
