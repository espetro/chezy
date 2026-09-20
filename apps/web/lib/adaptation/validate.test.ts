import { describe, expect, it } from "vitest";
import { FOCUS_FIELD, type AdaptationFocus, type ComparisonPanelSpec } from "@chezy/contract";
import { validateComparisonPanel, type ValidationContext } from "~/lib/adaptation/validate";

const ctx: ValidationContext = {
  feedbackEventId: "550e8400-e29b-41d4-a716-446655440000",
  profileVersion: `sha256:${"a".repeat(64)}`,
  focus: "missing_balcony",
  sourceListingIds: ["fotocasa:1", "fotocasa:2", "fotocasa:3"],
  expectedAttempt: 1,
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
  ])("rejects %s with a coded error", (_name, candidate, code, path) => {
    const result = validateComparisonPanel(candidate, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const matched = result.errors.find((e) => e.code === code);
      expect(matched).toBeDefined();
      if (path) expect(matched?.path).toBe(path);
    }
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
