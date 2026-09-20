import type { UserProfile } from "@chezy/contract";
import type { Listing, SearchProfile } from "~/lib/db/schema";
import { normalizeText } from "~/lib/geocode";

export type { UserProfile };

const USERNAME_MAX_LENGTH = 48;

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
}

export function missingProfileFields(profile: UserProfile | null | undefined): string[] {
  const missing: string[] = [];

  if (!profile?.areas || profile.areas.length === 0) {
    missing.push("areas");
  }
  if (profile?.budgetMaxEur === undefined || profile?.budgetMaxEur === null) {
    missing.push("budgetMaxEur");
  }
  if (profile?.bedroomsMin === undefined || profile?.bedroomsMin === null) {
    missing.push("bedroomsMin");
  }

  return missing;
}

export function mergeUserProfile(base: UserProfile, patch: UserProfile): UserProfile {
  const { freeformRequirements, onboardedAt: _onboardedAt, ...scalars } = patch;

  const merged: UserProfile = { ...base };

  for (const [key, value] of Object.entries(scalars)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  if (freeformRequirements !== undefined) {
    merged.freeformRequirements = [
      ...new Set([...(base.freeformRequirements ?? []), ...freeformRequirements]),
    ];
  }

  return merged;
}

// Chat-profile -> scorer-profile adapter. The chat path stores preferences in
// `User.profile` (jsonb); the scorer wants a `SearchProfile` row shape, so we
// synthesize one with placeholder row fields. workLat/Lon stay null because
// `workLocation` is free text and the chat path does not geocode.
export function toScoringProfile(profile: UserProfile): SearchProfile {
  const now = new Date(0);
  return {
    id: "chat-profile",
    userId: "chat-user",
    workAddress: profile.workLocation ?? "",
    workLat: null,
    workLon: null,
    maxCommuteMin: profile.maxCommuteMin ?? 25,
    neighbourhoods: profile.areas ?? [],
    minPriceEur: Math.round(profile.budgetMinEur ?? 0),
    maxPriceEur: Math.round(profile.budgetMaxEur ?? Number.MAX_SAFE_INTEGER),
    minRooms: Math.round(profile.bedroomsMin ?? 0),
    minM2: Math.round(profile.minM2 ?? 0),
    moveDate: null,
    flexibleDays: 0,
    mustHaves: profile.mustHaves ?? [],
    redLines: profile.redLines ?? [],
    alertsEnabled: true,
    verified: false,
    createdAt: now,
    updatedAt: now,
  };
}

const PRICE_WORDS = ["expensive", "price", "budget", "caro"];
const AREA_WORDS = ["far", "area", "zone", "barrio", "neighbourhood", "neighborhood", "lejos"];
const SIZE_WORDS = ["small", "tiny", "m2", "pequeño", "pequeno"];
const ELEVATOR_WORDS = ["elevator", "ascensor"];
const BALCONY_WORDS = ["balcony", "terrace", "terraza", "balcón", "balcon"];
const INTERIOR_WORDS = ["dark", "interior", "light", "luz"];
const FURNISHED_WORDS = ["furnished", "amueblado"];
const PETS_WORDS = ["pets", "mascota", "mascotas"];

const containsAny = (text: string, words: string[]): boolean =>
  words.some((w) => text.includes(w));

const addUnique = (list: string[] | undefined, item: string): string[] =>
  list?.includes(item) ? list : [...(list ?? []), item];

// Keyword-based preference inference from a rejection reason. Returns a
// UserProfile-shaped patch (only the fields that should change); the caller
// merges it. English + Spanish keywords since users mix both.
export function inferPreferencePatch(
  reason: string | undefined,
  listing: Pick<Listing, "priceEur" | "neighbourhood" | "district" | "builtM2">,
  profile: UserProfile,
): UserProfile {
  const patch: UserProfile = {};
  const text = normalizeText(reason ?? "");

  if (containsAny(text, PRICE_WORDS) && listing.priceEur !== null) {
    const current = profile.budgetMaxEur;
    if (current !== undefined && listing.priceEur > current) {
      patch.budgetMaxEur = Math.min(current, Math.round(listing.priceEur) - 1);
    } else {
      patch.budgetMaxEur = Math.round(listing.priceEur * 0.95);
    }
  }

  if (containsAny(text, AREA_WORDS)) {
    const rejected = new Set(
      [listing.neighbourhood, listing.district]
        .filter((v): v is string => v !== null)
        .map(normalizeText),
    );
    const kept = (profile.areas ?? []).filter((a) => !rejected.has(normalizeText(a)));
    if (kept.length !== (profile.areas ?? []).length) {
      patch.areas = kept;
    }
  }

  if (containsAny(text, SIZE_WORDS) && listing.builtM2 !== null) {
    patch.minM2 = Math.round(listing.builtM2) + 5;
  }

  if (containsAny(text, ELEVATOR_WORDS)) {
    patch.mustHaves = addUnique(patch.mustHaves ?? profile.mustHaves, "elevator");
  }
  if (containsAny(text, BALCONY_WORDS)) {
    patch.mustHaves = addUnique(patch.mustHaves ?? profile.mustHaves, "balcony_or_terrace");
  }
  if (containsAny(text, INTERIOR_WORDS)) {
    patch.mustHaves = addUnique(patch.mustHaves ?? profile.mustHaves, "exterior");
    patch.redLines = addUnique(profile.redLines, "no_interior");
  }
  if (containsAny(text, FURNISHED_WORDS)) {
    patch.mustHaves = addUnique(patch.mustHaves ?? profile.mustHaves, "furnished");
  }
  if (containsAny(text, PETS_WORDS)) {
    patch.mustHaves = addUnique(patch.mustHaves ?? profile.mustHaves, "pets_allowed");
  }

  return patch;
}
