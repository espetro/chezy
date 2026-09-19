import type { UserProfile } from "@chezy/contract";

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
