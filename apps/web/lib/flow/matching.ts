import { dealBreakerOptions, mustHaveOptions } from "@/lib/flow/onboarding-steps";
import type { Listing, UserPreferences } from "@/lib/flow/types";

export interface MatchSummary {
  count: number;
  bestScore: number;
}

const mustHaveTagById = new Map(mustHaveOptions.map((option) => [option.id, option.tag]));
const knownDealBreakers = new Set(dealBreakerOptions.map((option) => option.id));

export const matchesPreferences = (listing: Listing, prefs: UserPreferences): boolean => {
  if (prefs.zones.length > 0 && !prefs.zones.includes(listing.neighborhood)) return false;
  if (
    prefs.commuteMaxMin !== undefined &&
    listing.neighborhoodProfile.transitMinutesToWork > prefs.commuteMaxMin
  ) {
    return false;
  }
  if (listing.price < prefs.budgetMin || listing.price > prefs.budgetMax) return false;
  if (listing.rooms < prefs.rooms) return false;
  if (listing.sizeM2 < prefs.sizeMin) return false;

  for (const id of prefs.mustHaves) {
    const tag = mustHaveTagById.get(id);
    if (tag && !listing.tags.includes(tag)) return false;
  }

  for (const id of prefs.dealBreakers) {
    if (!knownDealBreakers.has(id as never)) continue;
    if (id === "no-dark-interior" && !listing.tags.includes("Exterior-facing")) return false;
    if (id === "no-excessive-deposit" && listing.depositMonths > 2) return false;
    if (id === "no-unknown-flatmates" && listing.sharedFlat) return false;
  }

  return true;
};

export const countMatches = (prefs: UserPreferences, listings: Listing[]): MatchSummary => {
  let count = 0;
  let bestScore = 0;
  for (const listing of listings) {
    if (!matchesPreferences(listing, prefs)) continue;
    count += 1;
    if (listing.matchScore > bestScore) bestScore = listing.matchScore;
  }
  return { count, bestScore };
};
