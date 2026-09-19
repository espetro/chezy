import { describe, expect, test } from "vitest";

import {
  mergeUserProfile,
  missingProfileFields,
  normalizeUsername,
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
    expect(missingProfileFields({})).toEqual([
      "areas",
      "budgetMaxEur",
      "bedroomsMin",
    ]);
  });

  test("treats nullish profiles as empty", () => {
    expect(missingProfileFields(null)).toEqual([
      "areas",
      "budgetMaxEur",
      "bedroomsMin",
    ]);
    expect(missingProfileFields(undefined)).toEqual([
      "areas",
      "budgetMaxEur",
      "bedroomsMin",
    ]);
  });

  test("reports only the absent fields on a partial profile", () => {
    expect(
      missingProfileFields({ areas: ["gracia"], budgetMaxEur: 1500 })
    ).toEqual(["bedroomsMin"]);
  });

  test("treats an empty areas array as missing", () => {
    expect(
      missingProfileFields({
        areas: [],
        budgetMaxEur: 1500,
        bedroomsMin: 2,
      })
    ).toEqual(["areas"]);
  });

  test("returns [] on a complete profile", () => {
    expect(
      missingProfileFields({
        areas: ["gracia"],
        budgetMaxEur: 1500,
        bedroomsMin: 2,
      })
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

    expect(merged.freeformRequirements).toEqual([
      "gym nearby",
      "pet friendly",
    ]);
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
    const merged = mergeUserProfile(
      {},
      { onboardedAt: "2026-09-19T00:00:00.000Z" }
    );

    expect(merged.onboardedAt).toBeUndefined();
  });
});
