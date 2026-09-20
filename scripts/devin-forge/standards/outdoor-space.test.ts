import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { hasOutdoorSpace } from "~/lib/adaptation/facts";
import { resolvePanel } from "~/lib/adaptation/resolve";
import type { CandidateFacts } from "~/lib/adaptation/types";
import { listing, type Listing } from "~/lib/db/schema";
import { toListingRow, type ListingRecord } from "~/lib/listings";

// Standard for the forge task "outdoor-space": photo-derived outdoor space
// (from the media enrichment step) becomes a nullable Listing column and
// feeds the balcony comparison. Absence stays unknown.

const facts = (over: Partial<CandidateFacts> = {}): CandidateFacts => ({
  id: "fotocasa:1",
  title: "Flat",
  priceEur: 1500,
  neighbourhood: "Gràcia",
  rooms: 2,
  builtM2: 70,
  amenities: [],
  outdoorSpace: null,
  ...over,
});

const row = (over: Partial<Listing> = {}): Listing => ({
  id: "fotocasa:1",
  platform: "fotocasa",
  platformId: "1",
  url: "https://example.invalid/1",
  operation: "rent",
  priceEur: 1700,
  pricePeriod: "month",
  propertyType: "flat",
  builtM2: 72.4,
  rooms: 2,
  bathrooms: 1,
  floor: "3",
  lat: 41.4,
  lon: 2.19,
  street: "Carrer de Pallars",
  neighbourhood: "Poblenou",
  district: "Sant Martí",
  municipality: "Barcelona",
  postalCode: "08005",
  amenities: [],
  title: "Bright flat",
  description: "desc",
  publisherName: "publisher",
  publisherKind: "agency",
  coverUrl: "https://example.invalid/cover.jpg",
  media: [],
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  outdoorSpace: null,
  ...over,
});

const record: ListingRecord = {
  platform: "fotocasa",
  platform_id: "1",
  url: "https://example.invalid/1",
  operation: "rent",
  price_eur: 1700,
  price_period: "month",
  property_type: "flat",
  built_m2: 72,
  rooms: 2,
  bathrooms: 1,
  floor: "3",
  lat: 41.4,
  lon: 2.19,
  street: null,
  neighbourhood: "Poblenou",
  district: null,
  municipality: "Barcelona",
  postal_code: null,
  amenities: [],
  title: "Bright flat",
  description: null,
  publisher: null,
  media: [],
  published_at: null,
};

const balconySpec = {
  schemaVersion: 1 as const,
  feedbackEventId: "550e8400-e29b-41d4-a716-446655440000",
  profileVersion: `sha256:${"a".repeat(64)}`,
  focus: "missing_balcony" as const,
  attempt: 1,
  title: "Homes with outdoor space",
  listingIds: ["fotocasa:1", "fotocasa:2"],
  rows: [{ field: "balcony" as const, label: "Balcony" }],
  actions: [],
};

describe("Listing.outdoorSpace column", () => {
  it("is a nullable text column named outdoorSpace", () => {
    const column = getTableColumns(listing).outdoorSpace;
    expect(column).toBeDefined();
    expect(column?.name).toBe("outdoorSpace");
    expect(column?.notNull).toBe(false);
  });
});

describe("toListingRow", () => {
  it("carries outdoor_space from the wire record", () => {
    expect(toListingRow({ ...record, outdoor_space: "terrace" }).outdoorSpace).toBe("terrace");
  });
  it("stores null when the record has no outdoor_space", () => {
    // oxlint-disable-next-line unicorn/no-null
    expect(toListingRow(record).outdoorSpace).toBeNull();
  });
});

describe("hasOutdoorSpace", () => {
  it.each([
    ["listed amenity", facts({ amenities: ["Terrace"] }), true],
    ["balcony seen in photos", facts({ outdoorSpace: "balcony" }), true],
    ["terrace seen in photos", facts({ outdoorSpace: "terrace" }), true],
    ["photos show no outdoor space", facts({ outdoorSpace: "none" }), false],
    ["nothing known", facts(), false],
  ])("%s", (_name, candidate, expected) => {
    expect(hasOutdoorSpace(candidate)).toBe(expected);
  });
});

describe("resolvePanel balcony cell", () => {
  const cells = (rows: Listing[]) =>
    resolvePanel({ ...balconySpec, listingIds: rows.map((item) => item.id) }, rows).rows[0]?.cells;

  it("prefers the listed amenity over the photo label", () => {
    expect(cells([row({ amenities: ["Balcony"], outdoorSpace: "terrace" })])).toEqual([
      "Balcony listed",
    ]);
  });
  it("labels photo-derived outdoor space explicitly", () => {
    expect(
      cells([
        row({ id: "fotocasa:1", outdoorSpace: "balcony" }),
        row({ id: "fotocasa:2", outdoorSpace: "terrace" }),
      ]),
    ).toEqual(["Balcony seen in photos", "Terrace seen in photos"]);
  });
  it("keeps the unknown case unknown", () => {
    expect(
      cells([row({ id: "fotocasa:1" }), row({ id: "fotocasa:2", outdoorSpace: "none" })]),
    ).toEqual(["Not listed", "Not listed"]);
  });
});
