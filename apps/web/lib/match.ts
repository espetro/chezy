import type { FeedbackEvent } from "@chezy/contract";
import { feedbackBoost } from "~/lib/feedback-ranking";
import { COMMUTE_MIN_PER_KM, COMMUTE_OVERHEAD_MIN } from "~/lib/constants";
import type { Listing, SearchProfile } from "~/lib/db/schema";
import { eur } from "~/lib/format";
import { type GeoPoint, normalizeText } from "~/lib/geocode";
import { dedupeListings } from "~/lib/listings";

export interface MatchResult {
  readonly score: number;
  readonly reasons: string[];
  readonly commuteMin?: number;
}

const MUST_HAVE_AMENITIES: Record<string, readonly string[]> = {
  exterior: ["exterior"],
  balcony_or_terrace: ["balcony", "terrace"],
  elevator: ["elevator"],
  air_conditioning: ["air_conditioning"],
  furnished: ["furnished"],
  pets_allowed: ["pets_allowed"],
  heating: ["heating"],
};

const MUST_HAVE_LABELS: Record<string, string> = {
  exterior: "exterior-facing",
  balcony_or_terrace: "balcony/terrace",
  elevator: "elevator",
  air_conditioning: "air conditioning",
  furnished: "furnished",
  pets_allowed: "pets allowed",
  heating: "heating",
};

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function estimateCommuteMin(a: GeoPoint, b: GeoPoint): number {
  return Math.round(haversineKm(a, b) * COMMUTE_MIN_PER_KM + COMMUTE_OVERHEAD_MIN);
}

function budgetScore(price: number, min: number, max: number): number {
  if (price <= max) {
    return 30;
  }
  // The epsilon keeps exact 5% boundaries (1.05, 1.10, ...) in their own tier
  // despite float error.
  const over = Math.ceil((price / max - 1) / 0.05 - 1e-9);
  return Math.max(0, 30 - 3 * over);
}

export function scoreListing(profile: SearchProfile, row: Listing): MatchResult {
  const reasons: string[] = [];
  let total = 0;

  const price = row.priceEur ?? 0;
  const budget = budgetScore(price, profile.minPriceEur, profile.maxPriceEur);
  total += budget;
  if (budget === 30) {
    reasons.push(`Within your budget (${eur.format(price)}/month)`);
  }

  if (profile.neighbourhoods.length === 0) {
    total += 25;
  } else {
    const targets = profile.neighbourhoods.map(normalizeText);
    const placeMatch = (value: string | null) => {
      if (!value) {
        return false;
      }
      const v = normalizeText(value);
      // Mirrors the ilike '%n%' candidate filter: substring in either
      // direction so "Gràcia" matches "Vila de Gràcia" and vice versa.
      return targets.some((t) => v.includes(t) || t.includes(v));
    };
    if (placeMatch(row.neighbourhood)) {
      total += 25;
      reasons.push(`In ${row.neighbourhood}, one of your preferred neighborhoods`);
    } else if (placeMatch(row.district)) {
      total += 15;
      reasons.push(`In ${row.district}, a district on your list`);
    }
  }

  if (profile.mustHaves.length === 0) {
    total += 25;
  } else {
    const amenities = new Set(row.amenities);
    const covered = profile.mustHaves.filter((mh) =>
      (MUST_HAVE_AMENITIES[mh] ?? [mh]).some((a) => amenities.has(a)),
    );
    total += 25 * (covered.length / profile.mustHaves.length);
    if (covered.length > 0) {
      const labels = covered.map((mh) => MUST_HAVE_LABELS[mh] ?? mh).join(", ");
      reasons.push(
        `Matches ${covered.length} of ${profile.mustHaves.length} must-haves: ${labels}`,
      );
    }
  }

  if ((row.rooms ?? 0) >= profile.minRooms) {
    total += 10;
  }
  if ((row.builtM2 ?? 0) >= profile.minM2) {
    total += 10;
  }
  if (row.rooms !== null && row.builtM2 !== null) {
    reasons.push(`${row.rooms} bedrooms and ${Math.round(row.builtM2)} m²`);
  }

  let commuteMin: number | undefined;
  if (
    profile.workLat !== null &&
    profile.workLon !== null &&
    row.lat !== null &&
    row.lon !== null
  ) {
    commuteMin = estimateCommuteMin(
      { lat: profile.workLat, lon: profile.workLon },
      { lat: row.lat, lon: row.lon },
    );
    if (commuteMin <= profile.maxCommuteMin) {
      reasons.push(`Estimated commute: ~${commuteMin} min to work`);
    }
  }

  return {
    score: Math.min(100, Math.max(0, Math.round(total))),
    reasons,
    commuteMin,
  };
}

// Only no_interior is computable today; the other red lines are stored
// for display only (the dataset has no deposit or flatmate data).
export function violatesRedLines(profile: SearchProfile, row: Listing): boolean {
  return profile.redLines.includes("no_interior") && !row.amenities.includes("exterior");
}

export function rankListings(
  profile: SearchProfile,
  rows: Listing[],
  feedback: readonly FeedbackEvent[] = [],
): Array<{ listing: Listing; match: MatchResult }> {
  const rejected = new Set(
    feedback.filter((event) => !event.undoneAt).map((event) => event.listingId),
  );
  const eligible = rows.filter((row) => !rejected.has(row.id) && !violatesRedLines(profile, row));
  return dedupeListings(eligible)
    .map((listing) => ({ listing, match: scoreListing(profile, listing) }))
    .sort(
      (a, b) =>
        b.match.score +
          feedbackBoost(b.listing, feedback) -
          (a.match.score + feedbackBoost(a.listing, feedback)) ||
        (a.listing.priceEur ?? 0) - (b.listing.priceEur ?? 0) ||
        a.listing.id.localeCompare(b.listing.id),
    );
}
