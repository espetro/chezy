import { describe, expect, it } from "vitest";

import type { Listing, SearchProfile } from "~/lib/db/schema";
import { estimateCommuteMin, haversineKm, rankListings, scoreListing } from "./match";

const baseProfile: SearchProfile = {
  id: "p1",
  userId: "u1",
  workAddress: "Diagonal 405",
  workLat: null,
  workLon: null,
  maxCommuteMin: 30,
  neighbourhoods: [],
  minPriceEur: 800,
  maxPriceEur: 1200,
  minRooms: 2,
  minM2: 60,
  moveDate: null,
  flexibleDays: 0,
  mustHaves: [],
  redLines: [],
  alertsEnabled: true,
  verified: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const makeListing = (over: Partial<Listing> = {}): Listing => ({
  id: "l1",
  platform: "idealista",
  platformId: "1",
  url: "https://example.com/1",
  operation: "rent",
  priceEur: 1000,
  pricePeriod: "month",
  propertyType: "flat",
  builtM2: 70,
  rooms: 2,
  bathrooms: 1,
  floor: "3",
  lat: null,
  lon: null,
  street: "Carrer X",
  neighbourhood: "Gràcia",
  district: "Gràcia",
  municipality: "Barcelona",
  postalCode: "08012",
  amenities: [],
  outdoorSpace: null,
  title: "Piso",
  description: null,
  publisherName: null,
  publisherKind: null,
  coverUrl: null,
  media: [],
  publishedAt: null,
  createdAt: new Date(0),
  ...over,
});

describe("scoreListing budget tiers", () => {
  it.each([
    [1000, 30],
    [1260, 27], // 5% over
    [1560, 12], // 30% over
    [600, 30], // below min: cheaper is fine
  ])("price %i scores %i on budget", (price, expected) => {
    const { score } = scoreListing(baseProfile, makeListing({ priceEur: price }));
    // budget contributes `expected`; total = expected + 25 (empty prefs) + 25 + 10 + 10
    expect(score).toBe(expected + 70);
  });
});

describe("scoreListing must-have coverage", () => {
  const profile = {
    ...baseProfile,
    mustHaves: ["exterior", "elevator", "heating"],
  };
  it.each([
    [[], 0],
    [["exterior", "elevator"], 2],
    [["exterior", "elevator", "heating"], 3],
  ])("amenities %j covers %i/3", (amenities, covered) => {
    const { score } = scoreListing(profile, makeListing({ amenities }));
    // +25 for empty neighbourhoods preference, +10 rooms, +10 m²
    const expected = 30 + 25 + 25 * (covered / 3) + 10 + 10;
    expect(score).toBe(Math.round(expected));
  });

  it("maps balcony_or_terrace onto either amenity", () => {
    const p = { ...baseProfile, mustHaves: ["balcony_or_terrace"] };
    expect(scoreListing(p, makeListing({ amenities: ["terrace"] })).score).toBe(
      30 + 25 + 25 + 10 + 10,
    );
    expect(scoreListing(p, makeListing({ amenities: ["balcony"] })).score).toBe(
      30 + 25 + 25 + 10 + 10,
    );
    expect(scoreListing(p, makeListing({ amenities: [] })).score).toBe(30 + 25 + 0 + 10 + 10);
  });
});

describe("scoreListing barrio", () => {
  const profile = { ...baseProfile, neighbourhoods: ["Gràcia", "Eixample"] };

  it("awards 25 on neighbourhood match", () => {
    const { score, reasons } = scoreListing(
      profile,
      makeListing({ neighbourhood: "gracia", district: "Other" }),
    );
    expect(score).toBe(30 + 25 + 25 + 10 + 10);
    expect(reasons.some((r) => r.includes("preferred neighborhoods"))).toBe(true);
  });

  it("awards 25 on substring containment either direction", () => {
    const { score } = scoreListing(
      profile,
      makeListing({ neighbourhood: "Vila de Gràcia", district: "Other" }),
    );
    expect(score).toBe(30 + 25 + 25 + 10 + 10);
  });

  it("awards 15 on district-only match", () => {
    const { score } = scoreListing(
      profile,
      makeListing({ neighbourhood: "Sants", district: "eixample" }),
    );
    expect(score).toBe(30 + 15 + 25 + 10 + 10);
  });

  it("awards 0 on no match", () => {
    const { score } = scoreListing(
      profile,
      makeListing({ neighbourhood: "Poble-sec", district: "Sants - Montjuïc" }),
    );
    expect(score).toBe(30 + 0 + 25 + 10 + 10);
  });
});

it("empty preferences score 100 with reasons", () => {
  const result = scoreListing(baseProfile, makeListing({ priceEur: 1000 }));
  expect(result.score).toBe(100);
  expect(result.reasons.length).toBeGreaterThan(0);
});

describe("rankListings red lines", () => {
  const rows = [
    makeListing({ id: "interior", rooms: 2, amenities: ["elevator"] }),
    makeListing({ id: "exterior", rooms: 3, amenities: ["exterior"] }),
  ];

  it("drops interior rows only when no_interior is set", () => {
    const withRedLine = { ...baseProfile, redLines: ["no_interior"] };
    expect(rankListings(withRedLine, rows).map((r) => r.listing.id)).toEqual(["exterior"]);
    expect(rankListings(baseProfile, rows)).toHaveLength(2);
  });
});

describe("score invariants", () => {
  it("stays within [0,100] over a generated grid", () => {
    const prices = [0, 400, 1000, 1200, 1500, 3000];
    const roomOpts = [0, 1, 2, 4];
    const m2Opts = [0, 30, 60, 120];
    for (const priceEur of prices) {
      for (const rooms of roomOpts) {
        for (const builtM2 of m2Opts) {
          const { score } = scoreListing(
            { ...baseProfile, mustHaves: ["exterior", "heating"] },
            makeListing({ priceEur, rooms, builtM2 }),
          );
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe("commute estimate", () => {
  const diagonal = { lat: 41.3954, lon: 2.1618 };
  const catalunya = { lat: 41.387, lon: 2.1701 };

  it("Diagonal → Pl. Catalunya ≈ 1.2 km", () => {
    expect(haversineKm(diagonal, catalunya)).toBeCloseTo(1.2, 1);
  });

  it("is monotone in distance", () => {
    const near = estimateCommuteMin(diagonal, catalunya);
    const far = estimateCommuteMin(diagonal, { lat: 41.45, lon: 2.25 });
    expect(far).toBeGreaterThan(near);
  });
});
