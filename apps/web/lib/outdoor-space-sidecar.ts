import { OutdoorSpaceSchema, type OutdoorSpace } from "@chezy/contract";
import * as v from "valibot";

// One line of chezy-mock-data/enriched/listing_outdoor_space.jsonl, written by
// `uv run scraper aggregate-outdoor-space` from the per-photo VLM labels.
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

export interface OutdoorSpaceSidecarParse {
  readonly sidecar: OutdoorSpaceSidecar;
  readonly failures: string[];
}

export function parseOutdoorSpaceSidecar(lines: Iterable<string>): OutdoorSpaceSidecarParse {
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

interface HasOutdoorSpace {
  readonly platform: string;
  readonly platform_id: string;
  readonly outdoor_space?: OutdoorSpace | null;
}

// A value already on the record wins; the sidecar only fills gaps.
export function mergeOutdoorSpace<T extends HasOutdoorSpace>(
  record: T,
  sidecar: OutdoorSpaceSidecar,
): T {
  if (record.outdoor_space !== undefined && record.outdoor_space !== null) {
    return record;
  }
  const fromSidecar = sidecar.get(sidecarKey(record.platform, record.platform_id));
  return fromSidecar === undefined ? record : { ...record, outdoor_space: fromSidecar };
}
