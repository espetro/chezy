// Valibot mirror of the pydantic `Listing` model in
// `apps/scraper/src/chezy_scraper/models.py`. Keep field names and enums in sync.
// Wire shape: snake_case, `null` for absent values (wire seam, so null is allowed).
import * as v from "valibot";

export const PlatformSchema = v.picklist([
  "fotocasa",
  "habitaclia",
  "idealista",
  "milanuncios",
  "pisos",
]);
export const OperationSchema = v.picklist(["rent", "sale"]);
export const PricePeriodSchema = v.picklist(["month", "total"]);
export const MediaKindSchema = v.picklist(["photo", "plan", "video", "tour_3d"]);
export const PublisherKindSchema = v.picklist(["professional", "private"]);
export const LocationAccuracySchema = v.picklist(["exact", "street", "zone"]);

const nullableString = v.nullable(v.string());
const nullableNumber = v.nullable(v.number());
const nullableInt = v.nullable(v.pipe(v.number(), v.integer()));
const nullableBoolean = v.nullable(v.boolean());

export const MediaSchema = v.strictObject({
  url: v.string(),
  kind: MediaKindSchema,
  room_type: nullableString,
  width: nullableInt,
  height: nullableInt,
  // Relative to the media root.
  local_path: nullableString,
});

export const PublisherSchema = v.strictObject({
  name: nullableString,
  kind: v.nullable(PublisherKindSchema),
  phone: nullableString,
  email: nullableString,
  profile_url: nullableString,
});

export const ListingSchema = v.strictObject({
  // identity
  platform: PlatformSchema,
  platform_id: v.string(),
  url: v.string(),
  scraped_at: v.pipe(v.string(), v.isoTimestamp()),
  published_at: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  updated_at: v.nullable(v.pipe(v.string(), v.isoTimestamp())),

  // transaction
  operation: OperationSchema,
  price_eur: nullableNumber,
  price_period: v.nullable(PricePeriodSchema),
  price_per_m2: nullableNumber,
  price_drop_eur: nullableNumber,
  deposit: nullableNumber,
  is_temporary_rental: nullableBoolean,

  // property
  property_type: nullableString,
  property_subtype: nullableString,
  built_m2: nullableNumber,
  usable_m2: nullableNumber,
  rooms: nullableInt,
  bathrooms: nullableInt,
  floor: nullableString,
  orientation: nullableString,
  year_built: nullableInt,
  condition: nullableString,
  furnished: nullableBoolean,
  heating: nullableString,
  energy_consumption_label: nullableString,
  energy_consumption_value: nullableNumber,
  energy_emissions_label: nullableString,
  energy_emissions_value: nullableNumber,

  // location
  lat: nullableNumber,
  lon: nullableNumber,
  street: nullableString,
  street_number: nullableString,
  neighbourhood: nullableString,
  district: nullableString,
  municipality: nullableString,
  postal_code: nullableString,
  location_accuracy: v.nullable(LocationAccuracySchema),

  // features
  amenities: v.array(v.string()),
  raw_features: v.record(v.string(), v.unknown()),

  media: v.array(MediaSchema),
  publisher: v.nullable(PublisherSchema),

  // text
  title: nullableString,
  description: nullableString,
  raw_html_excerpt: nullableString,
  source_raw: v.record(v.string(), v.unknown()),
});

export type Media = v.InferOutput<typeof MediaSchema>;
export type Publisher = v.InferOutput<typeof PublisherSchema>;
export type Listing = v.InferOutput<typeof ListingSchema>;
