// Loads chezy-mock-data/data/listings.jsonl into the Listing table.
// Idempotent upsert on (platform:platform_id). Run via `mise run db:seed`
// (loads apps/web/.env.local via --env-file; pg0 must be running).
import { createReadStream } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import * as v from "valibot";

import { db } from "@/lib/db/client";
import { listing } from "@/lib/db/schema";
import { ListingRecordSchema, toListingRow } from "@/lib/listings";

const DATASET = path.resolve(
  import.meta.dirname,
  "../../..",
  "chezy-mock-data/data/listings.jsonl",
);

const rl = createInterface({ input: createReadStream(DATASET) });

let batch: (typeof listing.$inferInsert)[] = [];
let seeded = 0;
const failures: string[] = [];

async function flush(): Promise<void> {
  if (batch.length === 0) {
    return;
  }
  await db
    .insert(listing)
    .values(batch)
    .onConflictDoUpdate({
      target: listing.id,
      set: {
        platform: listing.platform,
        platformId: listing.platformId,
        url: listing.url,
        operation: listing.operation,
        priceEur: listing.priceEur,
        pricePeriod: listing.pricePeriod,
        propertyType: listing.propertyType,
        builtM2: listing.builtM2,
        rooms: listing.rooms,
        bathrooms: listing.bathrooms,
        floor: listing.floor,
        lat: listing.lat,
        lon: listing.lon,
        street: listing.street,
        neighbourhood: listing.neighbourhood,
        district: listing.district,
        municipality: listing.municipality,
        postalCode: listing.postalCode,
        amenities: listing.amenities,
        title: listing.title,
        description: listing.description,
        publisherName: listing.publisherName,
        publisherKind: listing.publisherKind,
        coverUrl: listing.coverUrl,
        media: listing.media,
        publishedAt: listing.publishedAt,
      },
    });
  seeded += batch.length;
  batch = [];
}

for await (const line of rl) {
  if (!line.trim()) {
    continue;
  }
  const parsed = v.safeParse(ListingRecordSchema, JSON.parse(line));
  if (!parsed.success) {
    failures.push(v.summarize(parsed.issues));
    continue;
  }
  batch.push(toListingRow(parsed.output));
  if (batch.length >= 50) {
    await flush();
  }
}
await flush();

for (const failure of failures) {
  console.error(`skipped row: ${failure}`);
}
console.log(`seeded ${seeded} listings (${failures.length} skipped)`);
process.exit(failures.length > 0 ? 1 : 0);
