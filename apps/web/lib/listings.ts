import {
  and,
  asc,
  eq,
  gt,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/lib/db/client";
import { listing, type Listing } from "@/lib/db/schema";

// Loose parser for one line of chezy-mock-data/data/listings.jsonl — only the
// fields we persist; everything else is ignored.
const MediaItemSchema = v.object({
  url: v.string(),
  kind: v.string(),
  room_type: v.nullable(v.string()),
});

export const ListingRecordSchema = v.object({
  platform: v.string(),
  platform_id: v.string(),
  url: v.string(),
  operation: v.picklist(["rent", "sale"]),
  price_eur: v.nullable(v.number()),
  price_period: v.nullable(v.string()),
  property_type: v.nullable(v.string()),
  built_m2: v.nullable(v.number()),
  rooms: v.nullable(v.number()),
  bathrooms: v.nullable(v.number()),
  floor: v.nullable(v.string()),
  lat: v.nullable(v.number()),
  lon: v.nullable(v.number()),
  street: v.nullable(v.string()),
  neighbourhood: v.nullable(v.string()),
  district: v.nullable(v.string()),
  municipality: v.nullable(v.string()),
  postal_code: v.nullable(v.string()),
  amenities: v.optional(v.array(v.string()), []),
  title: v.nullable(v.string()),
  description: v.nullable(v.string()),
  publisher: v.nullable(
    v.object({ name: v.nullable(v.string()), kind: v.nullable(v.string()) }),
  ),
  media: v.optional(v.array(MediaItemSchema), []),
  published_at: v.nullable(v.string()),
});

export type ListingRecord = v.InferOutput<typeof ListingRecordSchema>;

export function toListingRow(
  record: ListingRecord,
): typeof listing.$inferInsert {
  return {
    id: `${record.platform}:${record.platform_id}`,
    platform: record.platform,
    platformId: record.platform_id,
    url: record.url,
    operation: record.operation,
    priceEur: record.price_eur,
    pricePeriod: record.price_period,
    propertyType: record.property_type,
    builtM2: record.built_m2,
    rooms: record.rooms,
    bathrooms: record.bathrooms,
    floor: record.floor,
    lat: record.lat,
    lon: record.lon,
    street: record.street,
    neighbourhood: record.neighbourhood,
    district: record.district,
    municipality: record.municipality,
    postalCode: record.postal_code,
    amenities: record.amenities,
    // A third of the dataset has no title; fall back to the first line of the
    // description so the column can stay notNull.
    title:
      record.title ?? record.description?.split("\n", 1)[0]?.slice(0, 120) ?? "",
    description: record.description,
    publisherName: record.publisher?.name ?? null,
    publisherKind: record.publisher?.kind ?? null,
    coverUrl:
      record.media.find((m) => m.kind === "photo")?.url ??
      record.media[0]?.url ??
      null,
    media: record.media.map((m) => ({
      url: m.url,
      kind: m.kind,
      roomType: m.room_type,
    })),
    publishedAt: record.published_at ? new Date(record.published_at) : null,
  };
}

export interface ListingSummary {
  readonly id: string;
  readonly title: string;
  readonly operation: string;
  readonly priceEur: number | null;
  readonly pricePeriod: string | null;
  readonly rooms: number | null;
  readonly bathrooms: number | null;
  readonly builtM2: number | null;
  readonly district: string | null;
  readonly neighbourhood: string | null;
  readonly url: string;
  readonly coverUrl: string | null;
  readonly description: string;
}

export function toListingSummary(row: Listing): ListingSummary {
  return {
    id: row.id,
    title: row.title,
    operation: row.operation,
    priceEur: row.priceEur,
    pricePeriod: row.pricePeriod,
    rooms: row.rooms,
    bathrooms: row.bathrooms,
    builtM2: row.builtM2,
    district: row.district,
    neighbourhood: row.neighbourhood,
    url: row.url,
    coverUrl: row.coverUrl,
    description: (row.description ?? "").slice(0, 300),
  };
}

export interface ListingSearch {
  readonly operation?: "rent" | "sale";
  readonly query?: string;
  readonly minPriceEur?: number;
  readonly maxPriceEur?: number;
  readonly minRooms?: number;
  readonly limit?: number;
}

export async function searchListings(
  search: ListingSearch,
): Promise<ListingSummary[]> {
  const filters: SQL[] = [gt(listing.priceEur, 0)];
  if (search.operation) {
    filters.push(eq(listing.operation, search.operation));
  }
  if (search.query) {
    const pattern = `%${search.query}%`;
    filters.push(
      or(
        ilike(listing.title, pattern),
        ilike(listing.district, pattern),
        ilike(listing.neighbourhood, pattern),
        ilike(listing.description, pattern),
      ) as SQL,
    );
  }
  if (search.minPriceEur !== undefined) {
    filters.push(gte(listing.priceEur, search.minPriceEur));
  }
  if (search.maxPriceEur !== undefined) {
    filters.push(lte(listing.priceEur, search.maxPriceEur));
  }
  if (search.minRooms !== undefined) {
    filters.push(gte(listing.rooms, search.minRooms));
  }
  const rows = await db
    .select()
    .from(listing)
    .where(and(...filters))
    .orderBy(asc(listing.priceEur))
    .limit(Math.min(search.limit ?? 5, 10));
  return rows.map(toListingSummary);
}

export async function getListingById(
  id: string,
): Promise<ListingSummary | undefined> {
  const rows = await db.select().from(listing).where(eq(listing.id, id));
  const row = rows[0];
  return row ? toListingSummary(row) : undefined;
}

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function listingToCallVariables(
  summary: ListingSummary,
): Record<string, string> {
  const price =
    summary.priceEur === null
      ? ""
      : summary.operation === "rent"
        ? `${eur.format(summary.priceEur)}/mes`
        : eur.format(summary.priceEur);
  return {
    property_ref: summary.id,
    property_title: summary.title,
    property_price: price,
    property_location: [summary.neighbourhood, summary.district]
      .filter((part): part is string => Boolean(part))
      .join(", "),
    property_rooms: summary.rooms?.toString() ?? "",
    property_m2: summary.builtM2?.toString() ?? "",
  };
}
