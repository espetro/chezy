import * as v from "valibot";

export const MUST_HAVES = [
  "exterior",
  "balcony_or_terrace",
  "elevator",
  "air_conditioning",
  "furnished",
  "pets_allowed",
  "heating",
] as const;

export const RED_LINES = ["no_interior", "no_high_deposit", "no_flatmates"] as const;

export const SearchProfileInputSchema = v.object({
  workAddress: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  maxCommuteMin: v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(120)),
  neighbourhoods: v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.maxLength(10)),
  minPriceEur: v.pipe(v.number(), v.integer(), v.minValue(0)),
  maxPriceEur: v.pipe(v.number(), v.integer(), v.minValue(0)),
  minRooms: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10)),
  minM2: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1000)),
  moveDate: v.nullable(v.pipe(v.string(), v.isoDate())),
  flexibleDays: v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(90)), 0),
  mustHaves: v.array(v.picklist(MUST_HAVES)),
  redLines: v.array(v.picklist(RED_LINES)),
  alertsEnabled: v.boolean(),
});

export type SearchProfileInput = v.InferOutput<typeof SearchProfileInputSchema>;

export const VerifyProfileInputSchema = v.object({ verified: v.literal(true) });
