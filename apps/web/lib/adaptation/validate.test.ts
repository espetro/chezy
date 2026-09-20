import { describe, expect, it } from "vitest";
import { FOCUS_FIELD, type AdaptationFocus, type ComparisonPanelSpec } from "@chezy/contract";
import type { CandidateFacts } from "~/lib/adaptation/types";
import { validateComparisonPanel, type ValidationContext } from "~/lib/adaptation/validate";

const facts = (
  id: string,
  overrides: Partial<Omit<CandidateFacts, "id">> = {},
): CandidateFacts => ({
  id,
  title: `Listing ${id}`,
  priceEur: 1500,
  neighbourhood: "Gràcia",
  rooms: 2,
  builtM2: 70,
  amenities: ["exterior"],
  outdoorSpace: null,
  ...overrides,
});

// Rejected: 1800 EUR in Poblenou without a balcony. fotocasa:1 improves on
// every focus, fotocasa:2 on none, fotocasa:3 has unknown facts.
const ctx: ValidationContext = {
  feedbackEventId: "550e8400-e29b-41d4-a716-446655440000",
  profileVersion: `sha256:${"a".repeat(64)}`,
  focus: "missing_balcony",
  sourceListingIds: ["fotocasa:1", "fotocasa:2", "fotocasa:3"],
  expectedAttempt: 1,
  rejectedListingId: "fotocasa:0",
  rejectedListingIds: ["fotocasa:0"],
  redLineListingIds: [],
  facts: {
    "fotocasa:0": facts("fotocasa:0", { priceEur: 1800, neighbourhood: "Poblenou" }),
    "fotocasa:1": facts("fotocasa:1", { amenities: ["exterior", "balcony"] }),
    "fotocasa:2": facts("fotocasa:2", { priceEur: 1900, neighbourhood: "Poblenou" }),
    "fotocasa:3": facts("fotocasa:3", { priceEur: null, neighbourhood: null, amenities: [] }),
  },
};

const specFor = (focus: AdaptationFocus): ComparisonPanelSpec => {
  const rows: ComparisonPanelSpec["rows"] = [{ field: FOCUS_FIELD[focus], label: "Focus" }];
  if (FOCUS_FIELD[focus] !== "price") rows.push({ field: "price", label: "Price" });
  return {
    schemaVersion: 1,
    feedbackEventId: ctx.feedbackEventId,
    profileVersion: ctx.profileVersion,
    focus,
    attempt: ctx.expectedAttempt,
    title: "A comparison",
    listingIds: ["fotocasa:1", "fotocasa:2"],
    rows,
    actions: ["open_listing"],
  };
};

describe("validateComparisonPanel", () => {
  it.each(["too_expensive", "wrong_area", "missing_balcony"] as const)(
    "accepts a matching spec for %s",
    (focus) => {
      const result = validateComparisonPanel(specFor(focus), { ...ctx, focus });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.spec.focus).toBe(focus);
    },
  );

  it.each([
    ["not an object", 42, "schema", ""],
    ["wrong attempt", { ...specFor("missing_balcony"), attempt: 2 }, "wrong_attempt", "attempt"],
    [
      "wrong feedbackEventId",
      { ...specFor("missing_balcony"), feedbackEventId: "550e8400-e29b-41d4-a716-446655440099" },
      "wrong_event",
      "feedbackEventId",
    ],
    [
      "wrong profileVersion",
      { ...specFor("missing_balcony"), profileVersion: `sha256:${"b".repeat(64)}` },
      "stale_profile",
      "profileVersion",
    ],
    ["wrong focus", { ...specFor("wrong_area"), focus: "too_expensive" }, "wrong_focus", "focus"],
    [
      "listing outside the candidate set",
      { ...specFor("missing_balcony"), listingIds: ["fotocasa:1", "fotocasa:9"] },
      "unknown_listing",
      "listingIds.1",
    ],
    [
      "missing focus row",
      { ...specFor("missing_balcony"), rows: [{ field: "price", label: "Price" }] },
      "missing_required_row",
      "rows",
    ],
    [
      "unknown action",
      { ...specFor("missing_balcony"), actions: ["book_viewing"] },
      "schema",
      "actions.0",
    ],
    [
      "unsupported field",
      {
        ...specFor("missing_balcony"),
        rows: [
          { field: "balcony", label: "Balcony" },
          { field: "sunlight", label: "Sun" },
        ],
      },
      "schema",
      "rows.1.field",
    ],
    [
      "the rejected listing itself",
      { ...specFor("missing_balcony"), listingIds: ["fotocasa:1", "fotocasa:0"] },
      "rejected_listing",
      "listingIds.1",
    ],
    [
      "a link in the title",
      { ...specFor("missing_balcony"), title: "See https://example.com" },
      "unsafe_text",
      "title",
    ],
    [
      "markup in a label",
      {
        ...specFor("missing_balcony"),
        rows: [{ field: "balcony", label: "<script>alert(1)</script>" }],
      },
      "unsafe_text",
      "rows.0.label",
    ],
    [
      "a script url in a note",
      {
        ...specFor("missing_balcony"),
        rows: [{ field: "balcony", label: "Balcony", note: "javascript:void(0)" }],
      },
      "unsafe_text",
      "rows.0.note",
    ],
    [
      "no listing with outdoor space although one exists",
      { ...specFor("missing_balcony"), listingIds: ["fotocasa:2", "fotocasa:3"] },
      "no_improvement",
      "listingIds",
    ],
  ])("rejects %s with a coded error", (_name, candidate, code, path) => {
    const result = validateComparisonPanel(candidate, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const matched = result.errors.find((e) => e.code === code);
      expect(matched).toBeDefined();
      if (path) expect(matched?.path).toBe(path);
    }
  });

  it.each(["too_expensive", "wrong_area", "missing_balcony"] as const)(
    "requires the %s row",
    (focus) => {
      const result = validateComparisonPanel(
        { ...specFor(focus), rows: [{ field: "rooms", label: "Rooms" }] },
        { ...ctx, focus },
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: "missing_required_row", path: "rows" }),
        );
      }
    },
  );

  it("rejects an allowlisted listing that violates a red line", () => {
    const result = validateComparisonPanel(specFor("missing_balcony"), {
      ...ctx,
      redLineListingIds: ["fotocasa:2"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "red_line_violation", path: "listingIds.1" }),
      );
    }
  });

  it("rejects a listing rejected after the session was briefed", () => {
    const result = validateComparisonPanel(specFor("missing_balcony"), {
      ...ctx,
      rejectedListingIds: ["fotocasa:0", "fotocasa:2"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.code)).toEqual(["rejected_listing"]);
    }
  });

  describe("no_improvement", () => {
    it.each([
      ["too_expensive", ["fotocasa:2", "fotocasa:3"], ["fotocasa:1", "fotocasa:3"]],
      ["wrong_area", ["fotocasa:2", "fotocasa:3"], ["fotocasa:1", "fotocasa:2"]],
      ["missing_balcony", ["fotocasa:2", "fotocasa:3"], ["fotocasa:1", "fotocasa:2"]],
    ] as const)("for %s", (focus, worse, better) => {
      const rejected = validateComparisonPanel(
        { ...specFor(focus), listingIds: [...worse] },
        { ...ctx, focus },
      );
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) expect(rejected.errors.map((e) => e.code)).toEqual(["no_improvement"]);
      expect(
        validateComparisonPanel({ ...specFor(focus), listingIds: [...better] }, { ...ctx, focus })
          .ok,
      ).toBe(true);
    });

    it("counts a price improvement only when both prices are known", () => {
      const result = validateComparisonPanel(
        { ...specFor("too_expensive"), listingIds: ["fotocasa:2", "fotocasa:3"] },
        {
          ...ctx,
          focus: "too_expensive",
          facts: {
            ...ctx.facts,
            "fotocasa:2": facts("fotocasa:2", { priceEur: 1500 }),
            "fotocasa:1": facts("fotocasa:1", { priceEur: null }),
          },
        },
      );
      expect(result.ok).toBe(true);
    });

    it("is vacuous when no eligible candidate can improve", () => {
      const result = validateComparisonPanel(
        { ...specFor("missing_balcony"), listingIds: ["fotocasa:2", "fotocasa:3"] },
        { ...ctx, redLineListingIds: ["fotocasa:1"] },
      );
      expect(result.ok).toBe(true);
    });

    it("treats a listing without amenities text as unknown, not as balcony-less", () => {
      const noBalconyAnywhere = validateComparisonPanel(
        { ...specFor("missing_balcony"), listingIds: ["fotocasa:2", "fotocasa:3"] },
        {
          ...ctx,
          facts: { ...ctx.facts, "fotocasa:1": facts("fotocasa:1", { amenities: [] }) },
        },
      );
      expect(noBalconyAnywhere.ok).toBe(true);
    });
  });

  it("collects every violation", () => {
    const result = validateComparisonPanel(
      {
        ...specFor("missing_balcony"),
        feedbackEventId: "550e8400-e29b-41d4-a716-446655440099",
        focus: "too_expensive",
        attempt: 9,
        listingIds: ["fotocasa:1", "fotocasa:9"],
        rows: [{ field: "price", label: "Price" }],
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.code)).toEqual(
        expect.arrayContaining([
          "wrong_attempt",
          "wrong_event",
          "wrong_focus",
          "unknown_listing",
          "missing_required_row",
        ]),
      );
    }
  });
});
