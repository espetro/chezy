import { describe, expect, it } from "vitest";
import * as v from "valibot";

import { identifyUserInputSchema, saveUserProfileInputSchema, userProfileSchema } from "./user";

describe("userProfileSchema", () => {
  it("parses a full valid profile", () => {
    const profile = v.parse(userProfileSchema, {
      areas: ["Gràcia", "Eixample"],
      budgetMinEur: 800,
      budgetMaxEur: 1400,
      bedroomsMin: 2,
      workLocation: "Passeig de Gràcia 1",
      freeformRequirements: ["gym nearby", "pet friendly"],
      onboardedAt: "2026-09-19T10:30:00.000Z",
    });
    expect(profile.budgetMaxEur).toBe(1400);
    expect(profile.areas).toHaveLength(2);
  });

  it("parses a partial profile with missing fields", () => {
    const profile = v.parse(userProfileSchema, { areas: ["Sants"] });
    expect(profile.areas).toEqual(["Sants"]);
    expect(profile.budgetMaxEur).toBeUndefined();
  });

  it("parses an empty profile", () => {
    expect(v.safeParse(userProfileSchema, {}).success).toBe(true);
  });

  it("rejects an empty-string area", () => {
    expect(v.safeParse(userProfileSchema, { areas: [""] }).success).toBe(false);
  });

  it("rejects a non-number budgetMaxEur", () => {
    expect(v.safeParse(userProfileSchema, { budgetMaxEur: "1400" }).success).toBe(false);
  });

  it("rejects a non-ISO onboardedAt", () => {
    expect(v.safeParse(userProfileSchema, { onboardedAt: "yesterday" }).success).toBe(false);
  });
});

describe("identifyUserInputSchema", () => {
  it("parses a valid username", () => {
    expect(v.parse(identifyUserInputSchema, { username: "joan" })).toEqual({
      username: "joan",
    });
  });

  it("rejects empty and overlong usernames", () => {
    expect(v.safeParse(identifyUserInputSchema, { username: "" }).success).toBe(false);
    expect(v.safeParse(identifyUserInputSchema, { username: "x".repeat(65) }).success).toBe(false);
  });
});

describe("saveUserProfileInputSchema", () => {
  it("parses username + patch", () => {
    const input = v.parse(saveUserProfileInputSchema, {
      username: "joan",
      patch: { budgetMaxEur: 1200 },
    });
    expect(input.patch.budgetMaxEur).toBe(1200);
  });

  it("rejects a bad patch", () => {
    expect(
      v.safeParse(saveUserProfileInputSchema, {
        username: "joan",
        patch: { bedroomsMin: "two" },
      }).success,
    ).toBe(false);
  });
});
