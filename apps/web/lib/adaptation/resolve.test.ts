import type { ComparisonField, ComparisonPanelSpec } from "@chezy/contract";
import { describe, expect, it } from "vitest";
import type { Listing } from "~/lib/db/schema";
import { resolvePanel, UNKNOWN_LISTING_TITLE } from "~/lib/adaptation/resolve";

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
  outdoorSpace: null,
  title: "BRIGHT FLAT IN POBLENOU",
  description: "desc",
  publisherName: "publisher",
  publisherKind: "agency",
  coverUrl: "https://example.invalid/cover.jpg",
  media: [],
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  ...over,
});

const spec = (over: Partial<ComparisonPanelSpec> = {}): ComparisonPanelSpec => ({
  schemaVersion: 1,
  feedbackEventId: "550e8400-e29b-41d4-a716-446655440000",
  profileVersion: `sha256:${"a".repeat(64)}`,
  focus: "missing_balcony",
  attempt: 1,
  title: "Homes with outdoor space",
  listingIds: ["fotocasa:1"],
  rows: [{ field: "price", label: "Price" }],
  actions: ["open_listing"],
  ...over,
});

const cell = (field: ComparisonField, listing: Listing) =>
  resolvePanel(spec({ rows: [{ field, label: "x" }] }), [listing]).rows[0]?.cells[0];

describe("resolvePanel", () => {
  it("carries title, focus and actions through", () => {
    const resolved = resolvePanel(spec(), [row()]);
    expect(resolved.title).toBe("Homes with outdoor space");
    expect(resolved.focus).toBe("missing_balcony");
    expect(resolved.actions).toEqual(["open_listing"]);
    expect(resolved.columns).toEqual([
      { listingId: "fotocasa:1", title: "Bright flat in poblenou" },
    ]);
  });

  it.each<[ComparisonField, Partial<Listing>, string]>([
    ["price", { priceEur: 1700 }, "1.700\u00a0€/mo"],
    ["price", { priceEur: null }, "Unknown"],
    ["area", { neighbourhood: "Poblenou", district: "Sant Martí" }, "Poblenou"],
    ["area", { neighbourhood: null, district: "Sant Martí" }, "Sant Martí"],
    ["area", { neighbourhood: null, district: null }, "Unknown"],
    ["balcony", { amenities: ["balcony"] }, "Balcony listed"],
    ["balcony", { amenities: ["Terrace"] }, "Terrace listed"],
    ["balcony", { amenities: ["exterior"] }, "Not listed"],
    ["rooms", { rooms: 3 }, "3 rooms"],
    ["rooms", { rooms: 1 }, "1 room"],
    ["rooms", { rooms: null }, "Unknown"],
    ["size", { builtM2: 72.4 }, "72 m²"],
    ["size", { builtM2: null }, "Unknown"],
  ])("%s cell for %j is %s", (field, over, expected) => {
    expect(cell(field, row(over))).toBe(expected);
  });

  it("cuts long column titles at a word boundary", () => {
    const long = row({
      title: "Descubre este acogedor apartamento de 3 habitaciones disponible ya",
    });
    const [column] = resolvePanel(spec(), [long]).columns;
    expect(column?.title).toBe("Descubre este acogedor apartamento de 3…");
    expect(column?.title.length).toBeLessThanOrEqual(49);
  });

  it("renders an Unknown listing column with Unknown cells for a missing row", () => {
    const resolved = resolvePanel(spec({ listingIds: ["fotocasa:missing"] }), []);
    expect(resolved.columns).toEqual([
      { listingId: "fotocasa:missing", title: UNKNOWN_LISTING_TITLE },
    ]);
    expect(resolved.rows[0]?.cells).toEqual(["Unknown"]);
  });

  it("keeps spec listing order for columns and cells", () => {
    const resolved = resolvePanel(spec({ listingIds: ["fotocasa:2", "fotocasa:1"] }), [
      row(),
      row({ id: "fotocasa:2", priceEur: 900 }),
    ]);
    expect(resolved.columns.map((column) => column.listingId)).toEqual([
      "fotocasa:2",
      "fotocasa:1",
    ]);
    expect(resolved.rows[0]?.cells).toEqual(["900\u00a0€/mo", "1.700\u00a0€/mo"]);
  });
});
