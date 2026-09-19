import { expect, test } from "vitest";
import { countMatches } from "@/lib/flow/matching";
import { mockListings } from "@/lib/flow/mock-listings";
import type { UserPreferences } from "@/lib/flow/types";

const open: UserPreferences = {
  workAddress: "",
  commuteMaxMin: undefined,
  zones: [],
  budgetMin: 600,
  budgetMax: 2000,
  rooms: 1,
  sizeMin: 40,
  moveIn: undefined,
  mustHaves: [],
  dealBreakers: [],
  alerts: true,
  autonomy: "cowork",
};

test("unanswered preferences match every listing", () => {
  expect(countMatches(open, mockListings)).toEqual({ count: 5, bestScore: 96 });
});

test("zones and budget narrow the set", () => {
  const prefs = { ...open, zones: ["Gràcia", "Eixample"], budgetMax: 1000 };
  expect(countMatches(prefs, mockListings)).toEqual({ count: 1, bestScore: 88 });
});

test("commute limit uses the neighborhood transit time", () => {
  expect(countMatches({ ...open, commuteMaxMin: 25 }, mockListings).count).toBe(3);
});

test("must-haves require the mapped tag; unmapped ones are ignored", () => {
  expect(countMatches({ ...open, mustHaves: ["furnished"] }, mockListings).count).toBe(1);
  expect(countMatches({ ...open, mustHaves: ["air-conditioning"] }, mockListings).count).toBe(5);
});

test("dealbreakers drop deposits over 2 months and shared flats", () => {
  const prefs = { ...open, dealBreakers: ["no-excessive-deposit", "no-unknown-flatmates"] };
  expect(countMatches(prefs, mockListings).count).toBe(3);
});

test("no matches reports a zero best score", () => {
  expect(countMatches({ ...open, budgetMax: 500 }, mockListings)).toEqual({
    count: 0,
    bestScore: 0,
  });
});
