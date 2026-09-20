import { describe, expect, test } from "vitest";

import {
  inferPreferencePatch,
  mergeUserProfile,
  missingProfileFields,
  normalizeUsername,
  toScoringProfile,
  type UserProfile,
} from "~/lib/user-profile";

describe("normalizeUsername", () => {
  test("lowercases and trims", () => {
    expect(normalizeUsername("  Alice  ")).toBe("alice");
  });

  test("collapses whitespace runs into a single dash", () => {
    expect(normalizeUsername("john   doe")).toBe("john-doe");
    expect(normalizeUsername("tab\tname")).toBe("tab-name");
  });

  test("strips characters outside [a-z0-9._-]", () => {
    expect(normalizeUsername("jo@hn! d*oe")).toBe("john-doe");
    expect(normalizeUsername("user#1$%")).toBe("user1");
  });

  test("keeps dots, underscores and dashes", () => {
    expect(normalizeUsername("a.b_c-d")).toBe("a.b_c-d");
  });

  test("clamps to 48 characters", () => {
    expect(normalizeUsername("x".repeat(100))).toBe("x".repeat(48));
  });

  test("returns an empty string when nothing survives", () => {
    expect(normalizeUsername("!!!")).toBe("");
    expect(normalizeUsername("   ")).toBe("");
  });
});

describe("missingProfileFields", () => {
  test("reports all required fields on an empty profile", () => {
    expect(missingProfileFields({})).toEqual(["areas", "budgetMaxEur", "bedroomsMin"]);
  });

  test("treats nullish profiles as empty", () => {
    expect(missingProfileFields(null)).toEqual(["areas", "budgetMaxEur", "bedroomsMin"]);
    expect(missingProfileFields(undefined)).toEqual(["areas", "budgetMaxEur", "bedroomsMin"]);
  });

  test("reports only the absent fields on a partial profile", () => {
    expect(missingProfileFields({ areas: ["gracia"], budgetMaxEur: 1500 })).toEqual([
      "bedroomsMin",
    ]);
  });

  test("treats an empty areas array as missing", () => {
    expect(
      missingProfileFields({
        areas: [],
        budgetMaxEur: 1500,
        bedroomsMin: 2,
      }),
    ).toEqual(["areas"]);
  });

  test("returns [] on a complete profile", () => {
    expect(
      missingProfileFields({
        areas: ["gracia"],
        budgetMaxEur: 1500,
        bedroomsMin: 2,
      }),
    ).toEqual([]);
  });
});

describe("mergeUserProfile", () => {
  test("overwrites scalar fields present in the patch", () => {
    const base: UserProfile = { budgetMaxEur: 1000, bedroomsMin: 1 };
    const merged = mergeUserProfile(base, { budgetMaxEur: 1500 });

    expect(merged.budgetMaxEur).toBe(1500);
    expect(merged.bedroomsMin).toBe(1);
  });

  test("appends and dedupes freeformRequirements", () => {
    const base: UserProfile = { freeformRequirements: ["gym nearby"] };
    const merged = mergeUserProfile(base, {
      freeformRequirements: ["gym nearby", "pet friendly"],
    });

    expect(merged.freeformRequirements).toEqual(["gym nearby", "pet friendly"]);
  });

  test("keeps existing freeformRequirements when the patch omits them", () => {
    const base: UserProfile = { freeformRequirements: ["gym nearby"] };
    const merged = mergeUserProfile(base, { budgetMaxEur: 1500 });

    expect(merged.freeformRequirements).toEqual(["gym nearby"]);
  });

  test("never removes existing keys", () => {
    const base: UserProfile = {
      areas: ["gracia"],
      workLocation: "poblenou",
    };
    const merged = mergeUserProfile(base, { budgetMaxEur: 1500 });

    expect(merged.areas).toEqual(["gracia"]);
    expect(merged.workLocation).toBe("poblenou");
  });

  test("ignores undefined patch values", () => {
    const base: UserProfile = { budgetMaxEur: 1000 };
    const merged = mergeUserProfile(base, { budgetMaxEur: undefined });

    expect(merged.budgetMaxEur).toBe(1000);
  });

  test("does not take onboardedAt from the patch", () => {
    const base: UserProfile = { onboardedAt: "2026-09-01T00:00:00.000Z" };
    const merged = mergeUserProfile(base, {
      budgetMaxEur: 1500,
      onboardedAt: "2026-09-19T00:00:00.000Z",
    });

    expect(merged.onboardedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  test("leaves onboardedAt unset when the base lacks it", () => {
    const merged = mergeUserProfile({}, { onboardedAt: "2026-09-19T00:00:00.000Z" });

    expect(merged.onboardedAt).toBeUndefined();
  });
});

describe("toScoringProfile", () => {
  test("maps chat profile fields onto the scorer shape", () => {
    const sp = toScoringProfile({
      areas: ["Gràcia", "Eixample"],
      budgetMaxEur: 1800,
      bedroomsMin: 2,
      mustHaves: ["elevator"],
      redLines: ["no_interior"],
      maxCommuteMin: 30,
      minM2: 60,
    });
    expect(sp.neighbourhoods).toEqual(["Gràcia", "Eixample"]);
    expect(sp.maxPriceEur).toBe(1800);
    expect(sp.minPriceEur).toBe(0);
    expect(sp.minRooms).toBe(2);
    expect(sp.minM2).toBe(60);
    expect(sp.maxCommuteMin).toBe(30);
    expect(sp.mustHaves).toEqual(["elevator"]);
    expect(sp.redLines).toEqual(["no_interior"]);
    expect(sp.workLat).toBeNull();
    expect(sp.workLon).toBeNull();
  });

  test("applies defaults for absent fields", () => {
    const sp = toScoringProfile({});
    expect(sp.neighbourhoods).toEqual([]);
    expect(sp.minRooms).toBe(0);
    expect(sp.minM2).toBe(0);
    expect(sp.maxCommuteMin).toBe(25);
    expect(sp.mustHaves).toEqual([]);
  });
});

describe("inferPreferencePatch", () => {
  const listing = {
    priceEur: 1900,
    neighbourhood: "Sants",
    district: "Sants-Montjuïc",
    builtM2: 55,
  };
  const profile: UserProfile = {
    areas: ["Gràcia", "Sants"],
    budgetMaxEur: 1800,
  };

  test.each<[string, Partial<UserProfile>]>([
    // 1900 is over the 1800 budget, so the budget stays (min(current, price-1)).
    ["too expensive", { budgetMaxEur: 1800 }],
    ["over my budget", { budgetMaxEur: 1800 }],
    ["too far from the centre", { areas: ["Gràcia"] }],
    ["wrong barrio", { areas: ["Gràcia"] }],
    ["too small", { minM2: 60 }],
    ["no elevator", { mustHaves: ["elevator"] }],
    ["sin ascensor", { mustHaves: ["elevator"] }],
    ["no balcony", { mustHaves: ["balcony_or_terrace"] }],
    ["sin terraza", { mustHaves: ["balcony_or_terrace"] }],
    ["very dark interior flat", { mustHaves: ["exterior"], redLines: ["no_interior"] }],
    ["not furnished", { mustHaves: ["furnished"] }],
    ["no pets allowed", { mustHaves: ["pets_allowed"] }],
  ])("reason %j -> %j", (reason, expected) => {
    expect(inferPreferencePatch(reason, listing, profile)).toMatchObject(expected);
  });

  test("lowers the budget to 95% of price when the listing was within it", () => {
    const patch = inferPreferencePatch("too expensive", listing, {
      budgetMaxEur: 2000,
    });
    expect(patch.budgetMaxEur).toBe(Math.round(1900 * 0.95));
  });

  test("keeps the current budget when the listing was already over it", () => {
    const patch = inferPreferencePatch("too expensive", listing, {
      budgetMaxEur: 1500,
    });
    expect(patch.budgetMaxEur).toBe(1500);
  });

  test("leaves areas untouched when the rejected place is not listed", () => {
    const patch = inferPreferencePatch("wrong area", listing, { areas: ["Gràcia"] });
    expect(patch.areas).toBeUndefined();
  });

  test("does not duplicate an existing must-have", () => {
    const patch = inferPreferencePatch("no elevator", listing, {
      mustHaves: ["elevator"],
    });
    expect(patch.mustHaves).toEqual(["elevator"]);
  });

  test("returns an empty patch for unrecognized reasons", () => {
    expect(inferPreferencePatch("ugly tiles", listing, profile)).toEqual({});
    expect(inferPreferencePatch(undefined, listing, profile)).toEqual({});
  });
});
