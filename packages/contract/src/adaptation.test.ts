import { describe, expect, it } from "vitest";
import * as v from "valibot";
import {
  ADAPTATION_FOCUSES,
  COMPARISON_ACTIONS,
  COMPARISON_ACTIONS_MAX,
  COMPARISON_FIELDS,
  COMPARISON_LISTINGS_MAX,
  COMPARISON_LISTINGS_MIN,
  COMPARISON_ROWS_MAX,
  COMPARISON_ROWS_MIN,
  ComparisonPanelSpecSchema,
  comparisonPanelJsonSchema,
  isAdaptationFocus,
} from "./adaptation";

const spec = {
  schemaVersion: 1,
  feedbackEventId: "550e8400-e29b-41d4-a716-446655440000",
  profileVersion: `sha256:${"a".repeat(64)}`,
  focus: "missing_balcony",
  attempt: 1,
  title: "Homes with outdoor space",
  listingIds: ["fotocasa:1", "fotocasa:2"],
  rows: [
    { field: "balcony", label: "Balcony" },
    { field: "price", label: "Price", note: "monthly rent" },
  ],
  actions: ["open_listing", "edit_preferences"],
};

describe("ComparisonPanelSpecSchema", () => {
  it("accepts a valid spec", () => {
    expect(v.safeParse(ComparisonPanelSpecSchema, spec).success).toBe(true);
  });
  it.each<[string, Record<string, unknown>]>([
    ["one listing id", { listingIds: ["fotocasa:1"] }],
    ["four listing ids", { listingIds: ["a", "b", "c", "d"] }],
    ["duplicate listing ids", { listingIds: ["a", "a"] }],
    ["zero rows", { rows: [] }],
    [
      "five rows",
      {
        rows: [
          { field: "price", label: "Price" },
          { field: "area", label: "Area" },
          { field: "balcony", label: "Balcony" },
          { field: "rooms", label: "Rooms" },
          { field: "size", label: "Size" },
        ],
      },
    ],
    ["free-form focus", { focus: "other" }],
    [
      "duplicate row field",
      {
        rows: [
          { field: "price", label: "Price" },
          { field: "price", label: "Price again" },
        ],
      },
    ],
    ["unknown row field", { rows: [{ field: "commute", label: "Commute" }] }],
    ["three actions", { actions: ["open_listing", "edit_preferences", "open_listing"] }],
    ["unknown action", { actions: ["open_listing", "call_agency"] }],
    ["missing attempt", { attempt: undefined }],
    ["attempt 0", { attempt: 0 }],
    ["attempt 1.5", { attempt: 1.5 }],
    ["missing schemaVersion", { schemaVersion: undefined }],
    ["extra key", { injected: true }],
  ])("rejects %s", (_name, override) => {
    const candidate: Record<string, unknown> = { ...spec, ...override };
    for (const key of ["schemaVersion", "attempt"]) {
      if (key in override && override[key] === undefined) delete candidate[key];
    }
    expect(v.safeParse(ComparisonPanelSpecSchema, candidate).success).toBe(false);
  });
});

describe("comparisonPanelJsonSchema twin", () => {
  it("requires exactly the Valibot object keys", () => {
    expect(comparisonPanelJsonSchema.required).toEqual(
      expect.arrayContaining(Object.keys(ComparisonPanelSpecSchema.entries)),
    );
    expect((comparisonPanelJsonSchema.required as string[]).length).toBe(
      Object.keys(ComparisonPanelSpecSchema.entries).length,
    );
  });
  const property = (name: string) =>
    (comparisonPanelJsonSchema.properties as Record<string, Record<string, unknown>>)[
      name
    ] as Record<string, unknown>;

  it("mirrors the enum constants", () => {
    expect(property("focus").enum).toEqual([...ADAPTATION_FOCUSES]);
    const rowItems = (property("rows").items as Record<string, unknown>).properties as Record<
      string,
      Record<string, unknown>
    >;
    expect(rowItems.field?.enum).toEqual([...COMPARISON_FIELDS]);
    expect((property("actions").items as Record<string, unknown>).enum).toEqual([
      ...COMPARISON_ACTIONS,
    ]);
  });
  it("mirrors the array bounds", () => {
    expect(property("listingIds").minItems).toBe(COMPARISON_LISTINGS_MIN);
    expect(property("listingIds").maxItems).toBe(COMPARISON_LISTINGS_MAX);
    expect(property("rows").minItems).toBe(COMPARISON_ROWS_MIN);
    expect(property("rows").maxItems).toBe(COMPARISON_ROWS_MAX);
    expect(property("actions").maxItems).toBe(COMPARISON_ACTIONS_MAX);
  });
});

describe("isAdaptationFocus", () => {
  it.each([
    ["too_expensive", true],
    ["wrong_area", true],
    ["missing_balcony", true],
    ["other", false],
  ] as const)("%s is %s", (reason, expected) => {
    expect(isAdaptationFocus(reason)).toBe(expected);
  });
});
