// Loads chezy-mock-data/data/listings.jsonl into the Listing table, filling
// outdoor_space from chezy-mock-data/enriched/listing_outdoor_space.jsonl when
// that sidecar exists (`uv run scraper aggregate-outdoor-space`).
// Idempotent upsert on (platform:platform_id). Run via `mise run db:seed`
// (loads apps/web/.env.local via --env-file; pg0 must be running).
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import * as v from "valibot";

import { db } from "~/lib/db/client";
import { listing } from "~/lib/db/schema";
import { ListingRecordSchema, toListingRow } from "~/lib/listings";
import { mergeOutdoorSpace, parseOutdoorSpaceSidecar } from "~/lib/outdoor-space-sidecar";

const MOCK_DATA = path.resolve(import.meta.dirname, "../../..", "chezy-mock-data");
const DATASET = path.join(MOCK_DATA, "data/listings.jsonl");
const OUTDOOR_SPACE_SIDECAR = path.join(MOCK_DATA, "enriched/listing_outdoor_space.jsonl");

const outdoorSpace = existsSync(OUTDOOR_SPACE_SIDECAR)
  ? parseOutdoorSpaceSidecar(readFileSync(OUTDOOR_SPACE_SIDECAR, "utf8").split("\n"))
  : undefined;
for (const failure of outdoorSpace?.failures ?? []) {
  console.error(`skipped outdoor_space sidecar row: ${failure}`);
}

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
        outdoorSpace: listing.outdoorSpace,
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
  const record = outdoorSpace
    ? mergeOutdoorSpace(parsed.output, outdoorSpace.sidecar)
    : parsed.output;
  batch.push(toListingRow(record));
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
