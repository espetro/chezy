import * as v from "valibot";

const int = v.pipe(v.number(), v.integer());

const roomType = v.fallback(
  v.picklist([
    "living_room",
    "bedroom",
    "kitchen",
    "bathroom",
    "dining",
    "hall",
    "terrace",
    "balcony",
    "exterior",
    "pool",
    "garden",
    "parking",
    "plan",
    "other",
  ]),
  "other",
);

const flooringKind = v.fallback(
  v.picklist([
    "parquet",
    "hydraulic_tile",
    "ceramic",
    "stone",
    "laminate",
    "concrete",
    "carpet",
    "other",
  ]),
  "other",
);

const ceilingFeature = v.fallback(
  v.picklist(["high_ceilings", "catalan_vault", "exposed_beams", "mouldings", "false_ceiling"]),
  "false_ceiling",
);

const windowFrame = v.fallback(v.picklist(["aluminum", "pvc", "wood", "unknown"]), "unknown");
const windowSize = v.fallback(
  v.picklist(["floor_to_ceiling", "large", "standard", "small"]),
  "standard",
);
const lightNatural = v.fallback(v.picklist(["low", "medium", "high"]), "medium");
const facing = v.fallback(v.picklist(["exterior", "interior", "mixed", "unknown"]), "unknown");
const outdoorSpace = v.fallback(
  v.picklist(["balcony", "terrace", "patio", "pool", "garden"]),
  "patio",
);
const view = v.fallback(v.picklist(["sea", "city", "street", "courtyard", "mountain"]), "street");
const kitchenLayout = v.fallback(v.picklist(["open", "closed", "unknown"]), "unknown");
const furnished = v.fallback(v.picklist(["full", "partial", "none", "unknown"]), "unknown");
const style = v.fallback(
  v.picklist(["modern", "classic_modernista", "rustic", "industrial", "nordic", "mixed"]),
  "mixed",
);

export const ListingInsightsSchema = v.object({
  per_image: v.array(v.object({ i: int, room_type: roomType })),
  condition: v.object({
    score_1to5: v.pipe(int, v.minValue(1), v.maxValue(5)),
    needs_renovation: v.boolean(),
  }),
  flooring: v.object({
    dominant: flooringKind,
    all: v.array(flooringKind),
    evidence: v.array(int),
  }),
  ceiling: v.object({ features: v.array(ceilingFeature), evidence: v.array(int) }),
  windows: v.object({
    frame: windowFrame,
    size: windowSize,
    shutters: v.boolean(),
    evidence: v.array(int),
  }),
  light: v.object({ natural: lightNatural, facing }),
  outdoor: v.object({ spaces: v.array(outdoorSpace), views: v.array(view) }),
  kitchen: v.object({
    layout: kitchenLayout,
    island: v.boolean(),
    appliances: v.array(v.string()),
    updated: v.boolean(),
  }),
  furnished,
  climate: v.object({
    ac_visible: v.boolean(),
    radiators_visible: v.boolean(),
    fireplace: v.boolean(),
  }),
  style,
  trust: v.object({
    virtual_staging: v.boolean(),
    renders: v.boolean(),
    red_flags: v.array(v.string()),
  }),
  highlights_es: v.array(v.string()),
  summary_es: v.string(),
});

export type ListingInsights = v.InferOutput<typeof ListingInsightsSchema>;
