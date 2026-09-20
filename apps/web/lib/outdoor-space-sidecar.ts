// Sidecar produced by `uv run scraper aggregate-outdoor-space`:
// chezy-mock-data/enriched/listing_outdoor_space.jsonl, one line per listing.
import { type OutdoorSpace, OutdoorSpaceSchema } from "@chezy/contract";
import * as v from "valibot";

export const OutdoorSpaceSidecarLineSchema = v.object({
  platform: v.string(),
  platform_id: v.string(),
  outdoor_space: OutdoorSpaceSchema,
});

export type OutdoorSpaceSidecarLine = v.InferOutput<typeof OutdoorSpaceSidecarLineSchema>;

// Keyed by `${platform}:${platform_id}`, the same id the Listing row uses.
export type OutdoorSpaceSidecar = ReadonlyMap<string, OutdoorSpace>;

export function sidecarKey(platform: string, platformId: string): string {
  return `${platform}:${platformId}`;
}

export function parseOutdoorSpaceSidecar(lines: Iterable<string>): {
  sidecar: OutdoorSpaceSidecar;
  failures: string[];
} {
  const sidecar = new Map<string, OutdoorSpace>();
  const failures: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const parsed = v.safeParse(OutdoorSpaceSidecarLineSchema, JSON.parse(line));
    if (!parsed.success) {
      failures.push(v.summarize(parsed.issues));
      continue;
    }
    sidecar.set(
      sidecarKey(parsed.output.platform, parsed.output.platform_id),
      parsed.output.outdoor_space,
    );
  }
  return { sidecar, failures };
}

type WithOutdoorSpace = {
  platform: string;
  platform_id: string;
  outdoor_space?: OutdoorSpace | null;
};

// A value already on the record wins; the sidecar only fills gaps. Records with
// no sidecar entry are returned untouched so their `outdoor_space` stays unknown.
export function mergeOutdoorSpace<T extends WithOutdoorSpace>(
  record: T,
  sidecar: OutdoorSpaceSidecar,
): T {
  if (record.outdoor_space) {
    return record;
  }
  const fromSidecar = sidecar.get(sidecarKey(record.platform, record.platform_id));
  if (fromSidecar === undefined) {
    return record;
  }
  return { ...record, outdoor_space: fromSidecar };
}
