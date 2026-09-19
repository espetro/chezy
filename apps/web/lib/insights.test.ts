import { describe, expect, it } from "vitest";

import { insightsToCallVariables, toInsightRow } from "~/lib/insights";
import type { ListingInsights } from "~/lib/vision/schema";

const INSIGHTS: ListingInsights = {
  per_image: [
    { i: 0, room_type: "pool" },
    { i: 1, room_type: "terrace" },
    { i: 2, room_type: "garden" },
    { i: 3, room_type: "living_room" },
    { i: 4, room_type: "kitchen" },
  ],
  condition: { score_1to5: 5, needs_renovation: false },
  flooring: {
    dominant: "parquet",
    all: ["parquet", "stone", "ceramic"],
    evidence: [3, 4, 5],
  },
  ceiling: { features: ["high_ceilings"], evidence: [3] },
  windows: {
    frame: "aluminum",
    size: "floor_to_ceiling",
    shutters: true,
    evidence: [1, 3],
  },
  light: { natural: "high", facing: "exterior" },
  outdoor: {
    spaces: ["terrace", "pool", "garden"],
    views: ["city", "mountain", "street"],
  },
  kitchen: {
    layout: "open",
    island: true,
    appliances: ["oven", "induction_hob", "sink", "refrigerator"],
    updated: true,
  },
  furnished: "none",
  climate: { ac_visible: true, radiators_visible: false, fireplace: true },
  style: "modern",
  trust: {
    virtual_staging: false,
    renders: false,
    red_flags: ["watermark_present"],
  },
  highlights_es: [
    "Terraza y piscina privadas",
    "Cocina abierta con isla",
    "Ventanales de suelo a techo",
    "Extra highlight",
  ],
  summary_es: "Piso moderno y luminoso con terraza, piscina y jardín.",
};

const EXTRACTION = {
  insights: INSIGHTS,
  model: "moonshotai/Kimi-K3",
  promptVersion: 1,
  usage: { promptTokens: 12345, completionTokens: 600 },
};

describe("toInsightRow", () => {
  it("flattens filterable facts into columns", () => {
    const row = toInsightRow("fotocasa:1", EXTRACTION);
    expect(row.listingId).toBe("fotocasa:1");
    expect(row.conditionScore).toBe(5);
    expect(row.flooringDominant).toBe("parquet");
    expect(row.flooringAll).toEqual(["parquet", "stone", "ceramic"]);
    expect(row.ceilingFeatures).toEqual(["high_ceilings"]);
    expect(row.windowSize).toBe("floor_to_ceiling");
    expect(row.lightNatural).toBe("high");
    expect(row.facing).toBe("exterior");
    expect(row.outdoorSpaces).toEqual(["terrace", "pool", "garden"]);
    expect(row.furnished).toBe("none");
    expect(row.style).toBe("modern");
    expect(row.acVisible).toBe(true);
    expect(row.virtualStaging).toBe(false);
    expect(row.promptTokens).toBe(12345);
  });
});

describe("insightsToCallVariables", () => {
  it("returns highlights (max 3) and condition", () => {
    expect(insightsToCallVariables(INSIGHTS)).toEqual({
      property_highlights:
        "Terraza y piscina privadas; Cocina abierta con isla; Ventanales de suelo a techo",
      property_condition: "5",
    });
  });
});
