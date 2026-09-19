import { describe, expect, it } from "vitest";

import type { CandidateFilter } from "~/lib/listings";
import type { Listing, SearchProfile } from "~/lib/db/schema";
import { buildFeed } from "./feed";

const profile: SearchProfile = {
  id: "p1",
  userId: "u1",
  workAddress: "Diagonal 405",
  workLat: null,
  workLon: null,
  maxCommuteMin: 25,
  neighbourhoods: ["Eixample"],
  minPriceEur: 1200,
  maxPriceEur: 2000,
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

const makeListing = (id: string): Listing =>
  ({
    id,
    platform: "fotocasa",
    platformId: id,
    url: `https://example.com/${id}`,
    operation: "rent",
    priceEur: 1500,
    pricePeriod: "month",
    propertyType: "flat",
    builtM2: 70,
    rooms: 2,
    bathrooms: 1,
    floor: null,
    lat: null,
    lon: null,
    street: null,
    neighbourhood: "Eixample",
    district: "Eixample",
    municipality: "Barcelona",
    postalCode: null,
    amenities: [],
    title: "Piso",
    description: null,
    publisherName: null,
    publisherKind: null,
    coverUrl: null,
    media: [],
    publishedAt: null,
    createdAt: new Date(0),
  }) as Listing;

const rows = (n: number) => Array.from({ length: n }, (_, i) => makeListing(`l${i}`));

// Records the filters it is called with and returns N rows per call site.
const scriptedRun = (sizes: number[]) => {
  const calls: CandidateFilter[] = [];
  const run = (filter: CandidateFilter) => {
    calls.push({ ...filter });
    return Promise.resolve(rows(sizes[Math.min(calls.length - 1, sizes.length - 1)] ?? 0));
  };
  return { calls, run };
};

describe("buildFeed ladder", () => {
  it("does not relax when the first run returns enough", async () => {
    const { run, calls } = scriptedRun([10]);
    const res = await buildFeed(profile, run);
    expect(res.relaxed).toEqual([]);
    expect(res.note).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      neighbourhoods: ["Eixample"],
      maxPriceEur: 2000,
      minRooms: 2,
      minM2: 60,
    });
  });

  it.each<[number[], string[]]>([
    [[0, 8], ["minM2"]],
    [
      [0, 0, 8],
      ["minM2", "neighbourhoods"],
    ],
    [
      [0, 0, 0, 8],
      ["minM2", "neighbourhoods", "maxPriceEur"],
    ],
    [
      [0, 0, 0, 0, 8],
      ["minM2", "neighbourhoods", "maxPriceEur", "minRooms"],
    ],
  ])("sizes %j relaxes %j", async (sizes, expected) => {
    const { run } = scriptedRun(sizes);
    const res = await buildFeed(profile, run);
    expect(res.relaxed).toEqual(expected);
    expect(res.note).toContain("Pocos pisos cumplen todo");
  });

  it("stops relaxing as soon as minItems is reached", async () => {
    const { run, calls } = scriptedRun([3, 9]);
    const res = await buildFeed(profile, run);
    expect(res.relaxed).toEqual(["minM2"]);
    expect(calls).toHaveLength(2);
    expect(calls[1].minM2).toBeUndefined();
    expect(calls[1].neighbourhoods).toEqual(["Eixample"]);
  });

  it("returns empty items and all four steps when nothing matches", async () => {
    const { run } = scriptedRun([0, 0, 0, 0, 0]);
    const res = await buildFeed(profile, run);
    expect(res.items).toEqual([]);
    expect(res.relaxed).toEqual(["minM2", "neighbourhoods", "maxPriceEur", "minRooms"]);
    expect(res.note).toBeTruthy();
  });

  it("composes the note with one clause per relaxed step", async () => {
    const { run } = scriptedRun([0, 0, 0, 8]);
    const res = await buildFeed(profile, run);
    expect(res.note).toContain("superficie mínima");
    expect(res.note).toContain("barrios");
    expect(res.note).toContain("presupuesto");
  });
});
