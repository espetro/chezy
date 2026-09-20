// Deterministic matching eval (no LLM). Runs with the unit suite so a scorer
// or adapter change that moves a demo listing across a band fails the gate.
// Contract: .agents/docs/demo-flow.md "Evals".
import { describe, expect, it } from "vitest";

import { AUTO_CALL_MATCH_THRESHOLD } from "~/lib/constants";
import { rankListings, scoreListing } from "~/lib/match";
import { toScoringProfile } from "~/lib/user-profile";
import { allListings, type Band, expectedBands, jessie, listings } from "./fixtures/jessie";

const profile = toScoringProfile(jessie);

function bandOf(score: number): Band {
  if (score >= AUTO_CALL_MATCH_THRESHOLD) {
    return "top";
  }
  if (score >= 80) {
    return "strong";
  }
  if (score >= 60) {
    return "weak";
  }
  return "poor";
}

describe("toScoringProfile (UserProfile -> scorer input)", () => {
  it("maps the onboarding fields the scorer reads", () => {
    expect(profile.neighbourhoods).toEqual(["Gràcia", "Eixample"]);
    expect(profile.maxPriceEur).toBe(1800);
    expect(profile.minRooms).toBe(2);
    expect(profile.mustHaves).toEqual(["elevator", "balcony_or_terrace"]);
    expect(profile.redLines).toEqual(["no_interior"]);
  });

  it("does not invent constraints the user never gave", () => {
    expect(profile.minPriceEur).toBe(0);
    expect(profile.minM2).toBe(0);
    expect(profile.workLat).toBeNull();
    expect(profile.workLon).toBeNull();
  });
});

describe("scorer golden set: Jessie vs 8 listings", () => {
  const ranked = rankListings(profile, allListings);
  const scoreById = new Map(ranked.map((r) => [r.listing.id, r.match.score]));

  it.each(Object.entries(expectedBands))("%s lands in band %s", (key, band) => {
    const row = listings[key as keyof typeof listings];
    const score = scoreById.get(row.id);
    if (band === "excluded") {
      expect(score, `${key} should be removed by a red line`).toBeUndefined();
      return;
    }
    expect(score, `${key} was filtered out`).toBeDefined();
    expect(bandOf(score as number), `${key} scored ${score}`).toBe(band);
  });

  it("exactly one listing clears the auto-call bar", () => {
    const top = ranked.filter((r) => r.match.score >= AUTO_CALL_MATCH_THRESHOLD);
    expect(top.map((r) => r.listing.id)).toEqual([listings.graciaPerfect.id]);
  });

  it("the perfect match is ranked first", () => {
    expect(ranked[0]?.listing.id).toBe(listings.graciaPerfect.id);
  });

  it("every reason string is English (chat is English-first)", () => {
    const spanish = /\b(dentro|presupuesto|barrio|habitaciones|cumple|trabajo)\b/i;
    for (const { listing, match } of ranked) {
      for (const reason of match.reasons) {
        expect(reason, `${listing.id}: ${reason}`).not.toMatch(spanish);
      }
    }
  });

  it("must-have coverage is monotonic", () => {
    const none = scoreListing(profile, { ...listings.graciaPerfect, amenities: ["exterior"] });
    const one = scoreListing(profile, {
      ...listings.graciaPerfect,
      amenities: ["exterior", "elevator"],
    });
    const both = scoreListing(profile, listings.graciaPerfect);
    expect(none.score).toBeLessThan(one.score);
    expect(one.score).toBeLessThan(both.score);
  });

  it("budget overshoot degrades in 5% tiers, never rewards", () => {
    const at = scoreListing(profile, { ...listings.graciaPerfect, priceEur: 1800 }).score;
    const over5 = scoreListing(profile, { ...listings.graciaPerfect, priceEur: 1890 }).score;
    const over10 = scoreListing(profile, { ...listings.graciaPerfect, priceEur: 1980 }).score;
    expect(at).toBe(100);
    expect(over5).toBeLessThan(at);
    expect(over10).toBeLessThan(over5);
  });

  // Product expectation the current weights do not meet: a 1-bed should not
  // outrank a 2-bed in-area flat for a 2-bed brief. Rooms are worth 10 points,
  // the same as m2, so gracia-one-room ties eixample-district-only at 90 and
  // wins on price. Flip to `it` once rooms is a hard filter or weighs more.
  it.fails("a 1-bed never ranks above an in-area 2-bed (known scorer gap)", () => {
    const order = ranked.map((r) => r.listing.id);
    expect(order.indexOf(listings.graciaOneRoom.id)).toBeGreaterThan(
      order.indexOf(listings.eixampleDistrictOnly.id),
    );
  });
});
