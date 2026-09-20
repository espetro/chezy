import type { FeedbackEvent } from "@chezy/contract";
import type { Listing, SearchProfile } from "~/lib/db/schema";
import { type CandidateFilter, listRentCandidates } from "~/lib/listings";
import { type MatchResult, rankListings } from "~/lib/match";

export type FeedRelaxation = "minM2" | "neighbourhoods" | "maxPriceEur" | "minRooms";

export interface FeedResult {
  readonly items: Array<{ listing: Listing; match: MatchResult }>;
  readonly relaxed: FeedRelaxation[];
  readonly note?: string;
}

const RELAX_ORDER: readonly FeedRelaxation[] = [
  "minM2",
  "neighbourhoods",
  "maxPriceEur",
  "minRooms",
];

const RELAX_CLAUSES: Record<FeedRelaxation, string> = {
  minM2: "minimum floor area",
  neighbourhoods: "neighborhoods",
  maxPriceEur: "budget",
  minRooms: "bedrooms",
};

export async function buildFeed(
  profile: SearchProfile,
  run: (filter: CandidateFilter) => Promise<Listing[]> = listRentCandidates,
  minItems = 8,
  feedback: readonly FeedbackEvent[] = [],
): Promise<FeedResult> {
  const filter: CandidateFilter = {
    neighbourhoods: profile.neighbourhoods,
    maxPriceEur: profile.maxPriceEur,
    minRooms: profile.minRooms,
    minM2: profile.minM2,
  };
  const relaxed: FeedRelaxation[] = [];

  let rows = await run(filter);
  for (const step of RELAX_ORDER) {
    if (rows.length >= minItems) {
      break;
    }
    relaxed.push(step);
    if (step === "minM2") {
      filter.minM2 = undefined;
    } else if (step === "neighbourhoods") {
      filter.neighbourhoods = undefined;
    } else if (step === "maxPriceEur") {
      filter.maxPriceEur = undefined;
    } else {
      filter.minRooms = undefined;
    }
    rows = await run(filter);
  }

  const items = rankListings(profile, rows, feedback).slice(0, 20);
  const note =
    relaxed.length > 0
      ? `Few homes meet every preference: we broadened ${relaxed
          .map((s) => RELAX_CLAUSES[s])
          .join(", ")} to show more options.`
      : undefined;

  return { items, relaxed, note };
}
