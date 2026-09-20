// Mirror of the tables created by `apps/scraper/src/chezy_scraper/sinks/postgres.py`.
// The scraper owns the DDL (create-if-missing); keep column names and types in
// sync with LISTING_COLUMNS there. Fields follow the pydantic `Listing` model.
import {
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const listings = pgTable(
  "listings",
  {
    // identity
    platform: text("platform").notNull(),
    platformId: text("platform_id").notNull(),
    url: text("url").notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),

    // transaction
    operation: text("operation").notNull(),
    priceEur: doublePrecision("price_eur"),
    pricePeriod: text("price_period"),
    pricePerM2: doublePrecision("price_per_m2"),
    priceDropEur: doublePrecision("price_drop_eur"),
    deposit: doublePrecision("deposit"),
    isTemporaryRental: boolean("is_temporary_rental"),

    // property
    propertyType: text("property_type"),
    propertySubtype: text("property_subtype"),
    builtM2: doublePrecision("built_m2"),
    usableM2: doublePrecision("usable_m2"),
    rooms: integer("rooms"),
    bathrooms: integer("bathrooms"),
    floor: text("floor"),
    orientation: text("orientation"),
    yearBuilt: integer("year_built"),
    condition: text("condition"),
    furnished: boolean("furnished"),
    heating: text("heating"),
    energyConsumptionLabel: text("energy_consumption_label"),
    energyConsumptionValue: doublePrecision("energy_consumption_value"),
    energyEmissionsLabel: text("energy_emissions_label"),
    energyEmissionsValue: doublePrecision("energy_emissions_value"),

    // location
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    street: text("street"),
    streetNumber: text("street_number"),
    neighbourhood: text("neighbourhood"),
    district: text("district"),
    municipality: text("municipality"),
    postalCode: text("postal_code"),
    locationAccuracy: text("location_accuracy"),

    // features
    amenities: text("amenities").array().notNull().default([]),
    rawFeatures: jsonb("raw_features").$type<Record<string, unknown>>().notNull().default({}),

    // publisher (flattened)
    publisherName: text("publisher_name"),
    publisherKind: text("publisher_kind"),
    publisherPhone: text("publisher_phone"),
    publisherEmail: text("publisher_email"),
    publisherProfileUrl: text("publisher_profile_url"),

    // text
    title: text("title"),
    description: text("description"),
    rawHtmlExcerpt: text("raw_html_excerpt"),
    sourceRaw: jsonb("source_raw").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    primaryKey({ columns: [t.platform, t.platformId] }),
    index("listings_operation_idx").on(t.operation, t.priceEur),
    index("listings_geo_idx").on(t.lat, t.lon),
  ],
);

export const listingMedia = pgTable(
  "listing_media",
  {
    platform: text("platform").notNull(),
    platformId: text("platform_id").notNull(),
    position: integer("position").notNull(),
    url: text("url").notNull(),
    kind: text("kind").notNull(),
    roomType: text("room_type"),
    width: integer("width"),
    height: integer("height"),
    // Relative to the media root (CHEZY_MEDIA_DIR).
    localPath: text("local_path"),
  },
  (t) => [
    primaryKey({ columns: [t.platform, t.platformId, t.position] }),
    foreignKey({
      columns: [t.platform, t.platformId],
      foreignColumns: [listings.platform, listings.platformId],
    }).onDelete("cascade"),
  ],
);

export type ListingRow = typeof listings.$inferSelect;
export type ListingMediaRow = typeof listingMedia.$inferSelect;
