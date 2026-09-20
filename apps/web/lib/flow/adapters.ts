import type { SearchProfileInput } from "@chezy/contract";

import type { Listing, SearchProfile } from "~/lib/db/schema";
import { sentenceCase } from "~/lib/format";
import type { MatchResult } from "~/lib/match";
import { getDistrictProfile } from "~/lib/neighbourhoods";
import type {
  CommuteMax,
  FlowListing,
  ListingTag,
  NeighborhoodProfile,
  UserPreferences,
} from "~/lib/flow/types";

const MUST_HAVE_TO_SEARCH: Record<string, string> = {
  "natural-light": "exterior",
  balcony: "balcony_or_terrace",
  elevator: "elevator",
  "air-conditioning": "air_conditioning",
  furnished: "furnished",
  pets: "pets_allowed",
};

const RED_LINE_TO_SEARCH: Record<string, string> = {
  "no-dark-interior": "no_interior",
  "no-excessive-deposit": "no_high_deposit",
  "no-suspicious-ads": "no_suspicious_ads",
};

const commuteValues = new Set<number>([15, 25, 40]);

export function toSearchProfileInput(prefs: UserPreferences): SearchProfileInput {
  return {
    workAddress: prefs.workAddress,
    maxCommuteMin: prefs.commuteMaxMin ?? 25,
    neighbourhoods: prefs.zones,
    minPriceEur: prefs.budgetMin,
    maxPriceEur: prefs.budgetMax,
    minRooms: prefs.rooms,
    minM2: prefs.sizeMin,
    // oxlint-disable-next-line unicorn/no-null
    moveDate: prefs.moveIn?.mode === "date" ? prefs.moveIn.date : null,
    flexibleDays: prefs.moveIn?.mode === "flexible" ? 15 : 0,
    mustHaves: prefs.mustHaves
      .map((id) => MUST_HAVE_TO_SEARCH[id])
      .filter((id): id is string => id !== undefined) as SearchProfileInput["mustHaves"],
    redLines: prefs.dealBreakers
      .map((id) => RED_LINE_TO_SEARCH[id])
      .filter((id): id is string => id !== undefined) as SearchProfileInput["redLines"],
    alertsEnabled: prefs.alerts,
    // `autonomy` is a /flow-only concept for now; SearchProfile has no column for it yet.
  };
}

export function fromSearchProfile(profile: SearchProfile): UserPreferences {
  const inverse = (map: Record<string, string>, values: string[]) =>
    values
      .map((value) => Object.keys(map).find((key) => map[key] === value))
      .filter((id): id is string => id !== undefined);

  return {
    workAddress: profile.workAddress,
    commuteMaxMin: commuteValues.has(profile.maxCommuteMin)
      ? (profile.maxCommuteMin as CommuteMax)
      : 25,
    zones: profile.neighbourhoods,
    budgetMin: profile.minPriceEur,
    budgetMax: profile.maxPriceEur,
    rooms: profile.minRooms,
    sizeMin: profile.minM2,
    moveIn:
      profile.flexibleDays > 0
        ? { mode: "flexible" }
        : profile.moveDate
          ? { mode: "date", date: profile.moveDate }
          : undefined,
    mustHaves: inverse(MUST_HAVE_TO_SEARCH, profile.mustHaves),
    dealBreakers: inverse(RED_LINE_TO_SEARCH, profile.redLines),
    alerts: profile.alertsEnabled,
    autonomy: "cowork",
  };
}

const NIGHTLIFE_BY_LIFE = { "Muy Alta": 85, Alta: 70, Media: 50 } as const;
const NOISE_BY_LEVEL = { Bajo: 25, "Bajo / Medio": 40, Medio: 55, Alto: 75 } as const;

const TAG_BY_AMENITY: Array<[string, ListingTag]> = [
  ["furnished", "Furnished"],
  ["pets_allowed", "Pets allowed"],
  ["exterior", "Exterior-facing"],
  ["elevator", "Elevator"],
  ["terrace", "Terrace"],
  ["balcony", "Terrace"],
];

function neighborhoodProfile(
  district: string | null,
  transitMinutesToWork: number,
): NeighborhoodProfile {
  const profile = district ? getDistrictProfile(district) : undefined;
  if (!profile) {
    return { shops: 60, nightlife: 50, safety: 70, noise: 45, transitMinutesToWork };
  }
  return {
    shops: Math.round(profile.commerce * 10),
    safety: Math.round(profile.safety * 10),
    nightlife: NIGHTLIFE_BY_LIFE[profile.life],
    noise: NOISE_BY_LEVEL[profile.noise],
    transitMinutesToWork,
  };
}

export function toFlowListing(
  row: Listing,
  match: MatchResult,
  profile?: SearchProfile,
): FlowListing {
  const neighborhood = row.neighbourhood ?? row.district ?? "Barcelona";
  const title = sentenceCase(row.title ?? "").slice(0, 80);
  const tags = TAG_BY_AMENITY.filter(([amenity]) => row.amenities.includes(amenity))
    .map(([, tag]) => tag)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 4);

  return {
    id: row.id,
    title: title || `Apartment in ${neighborhood}`,
    neighborhood,
    city: "Barcelona",
    price: Math.round(row.priceEur ?? 0),
    sizeM2: Math.round(row.builtM2 ?? 0),
    rooms: row.rooms ?? 0,
    imageUrl: row.coverUrl ?? "",
    agency: row.publisherName ?? "the agency",
    tags,
    // The dataset has no deposit field; assume one month until we collect it.
    depositMonths: 1,
    sharedFlat: false,
    matchScore: match.score,
    outdoorEvidence: row.amenities.includes("balcony")
      ? "Balcony reported in listing amenities"
      : row.amenities.includes("terrace")
        ? "Terrace reported in listing amenities"
        : undefined,
    matchReasons: match.reasons.map((label) => ({ label, detail: "" })),
    neighborhoodProfile: neighborhoodProfile(
      row.district,
      match.commuteMin ?? profile?.maxCommuteMin ?? 25,
    ),
    availableFrom: "Now",
  };
}
