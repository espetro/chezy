import { createReadStream } from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { listing, listingInsight } from "@/lib/db/schema";
import { extractListingInsights } from "@/lib/vision/extract";
import { INSIGHTS_PROMPT_VERSION } from "@/lib/vision/prompt";
import type { ListingInsights } from "@/lib/vision/schema";

type Extraction = Awaited<ReturnType<typeof extractListingInsights>>;

export function toInsightRow(
  listingId: string,
  extraction: Extraction,
): typeof listingInsight.$inferInsert {
  const i = extraction.insights;
  return {
    listingId,
    insights: i,
    model: extraction.model,
    promptVersion: extraction.promptVersion,
    promptTokens: extraction.usage.promptTokens,
    completionTokens: extraction.usage.completionTokens,
    conditionScore: i.condition.score_1to5,
    flooringDominant: i.flooring.dominant,
    flooringAll: i.flooring.all,
    ceilingFeatures: i.ceiling.features,
    windowSize: i.windows.size,
    lightNatural: i.light.natural,
    facing: i.light.facing,
    outdoorSpaces: i.outdoor.spaces,
    furnished: i.furnished,
    style: i.style,
    acVisible: i.climate.ac_visible,
    virtualStaging: i.trust.virtual_staging,
  };
}

export async function getListingInsights(listingId: string): Promise<ListingInsights | undefined> {
  const rows = await db
    .select()
    .from(listingInsight)
    .where(eq(listingInsight.listingId, listingId));
  return rows[0]?.insights;
}

// lib/insights.ts -> apps/web -> repo root (has chezy-mock-data/).
// import.meta.dirname is undefined in next build's module-evaluation context
// (page-data collection), so resolve lazily from cwd: next always runs with
// the app dir as cwd in dev/start/build.
const REPO_ROOT = () => path.resolve(process.cwd(), "../..");

// Media items marked `photo` can actually be portal-embedded 3D-tour / viewer
// links (plushglobalmedia, matterport, floorfy, inmovilla) that the provider
// can't fetch. When no local file exists, only trust image-CDN hosts.
function isCdnImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /^(static|images|img|cdn|media|photos)[.-]/.test(host);
  } catch {
    return false;
  }
}
const JSONL = () => path.join(REPO_ROOT(), "chezy-mock-data", "data", "listings.jsonl");

let localPathIndex: Map<string, Map<string, string>> | undefined;

// Maps listingId -> (media url -> local_path) so the VLM gets the cheaper
// local WebPs. Parsed lazily from the committed JSONL (300 rows).
async function datasetLocalPaths(listingId: string): Promise<Map<string, string>> {
  if (!localPathIndex) {
    localPathIndex = new Map();
    const rl = readline.createInterface({
      input: createReadStream(JSONL()),
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    for await (const line of rl) {
      if (!line.trim()) {
        continue;
      }
      const record = JSON.parse(line) as {
        platform: string;
        platform_id: string;
        media?: { url: string; local_path?: string | null }[];
      };
      const byUrl = new Map<string, string>();
      for (const m of record.media ?? []) {
        if (m.local_path) {
          byUrl.set(m.url, m.local_path);
        }
      }
      localPathIndex.set(`${record.platform}:${record.platform_id}`, byUrl);
    }
  }
  return localPathIndex.get(listingId) ?? new Map();
}

// The photo list sent to the VLM for a listing row: `photo` items that have a
// local file or a CDN URL, in media order. per_image/evidence indexes refer to
// positions in this list.
export async function selectPhotos(row: {
  id: string;
  media: { url: string; kind: string; roomType: string | null }[];
}): Promise<{ url: string; localPath: string | null; mediaIndex: number }[]> {
  const localPaths = await datasetLocalPaths(row.id);
  return row.media
    .map((m, mediaIndex) => ({
      url: m.url,
      localPath: localPaths.get(m.url) ?? null,
      kind: m.kind,
      mediaIndex,
    }))
    .filter((p) => p.kind === "photo" && (p.localPath !== null || isCdnImageUrl(p.url)))
    .map(({ url, localPath, mediaIndex }) => ({ url, localPath, mediaIndex }));
}

export async function ensureListingInsights(
  listingId: string,
  opts?: { force?: boolean; modelId?: string },
): Promise<ListingInsights> {
  const rows = await db.select().from(listing).where(eq(listing.id, listingId));
  const row = rows[0];
  if (!row) {
    throw new Error(`listing not found: ${listingId}`);
  }

  const stored = await db
    .select()
    .from(listingInsight)
    .where(eq(listingInsight.listingId, listingId));
  const current = stored[0];
  if (!opts?.force && current && current.promptVersion === INSIGHTS_PROMPT_VERSION) {
    return current.insights;
  }

  const selected = await selectPhotos(row);
  const photos = selected.map(({ url, localPath }) => ({ url, localPath }));
  const photoMediaIndexes = selected.map((p) => p.mediaIndex);

  const extraction = await extractListingInsights(
    { listingId, photos },
    { modelId: opts?.modelId },
  );
  const insights = extraction.insights;

  await db
    .insert(listingInsight)
    .values(toInsightRow(listingId, extraction))
    .onConflictDoUpdate({
      target: listingInsight.listingId,
      set: toInsightRow(listingId, extraction),
    });

  // Backfill null roomType in listing.media from per_image classifications.
  // per_image `i` indexes the filtered `photos` array; map back through
  // photoMediaIndexes to the media position.
  const media = row.media.map((m) => ({ ...m }));
  const byIndex = new Map(insights.per_image.map((p) => [p.i, p.room_type]));
  let dirty = false;
  for (const [photoIndex, mediaIndex] of photoMediaIndexes.entries()) {
    const roomType = byIndex.get(photoIndex);
    const m = media[mediaIndex];
    if (m.roomType === null && roomType) {
      m.roomType = roomType;
      dirty = true;
    }
  }
  if (dirty) {
    await db.update(listing).set({ media }).where(eq(listing.id, listingId));
  }

  return insights;
}

export function insightsToCallVariables(insights: ListingInsights): Record<string, string> {
  return {
    property_highlights: insights.highlights_es.slice(0, 3).join("; "),
    property_condition: String(insights.condition.score_1to5),
  };
}
