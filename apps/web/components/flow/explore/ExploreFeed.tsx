"use client";

import { useState } from "react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { CandidateCarousel } from "~/components/flow/explore/CandidateCarousel";
import type { FlowListing } from "~/lib/flow/types";

type SortMode = "match" | "price-asc";

const ALL_ZONES = "all";

const filterLabelClass = "flex w-full items-center gap-2 text-[13px] text-fog sm:w-auto";

const filterSelectClass =
  "h-11 min-w-0 flex-1 rounded-inputs border border-mist bg-snow px-3 py-2 text-[13px] text-graphite outline-none focus-visible:ring-2 focus-visible:ring-obsidian sm:flex-none";

interface ExploreFeedProps {
  listings: FlowListing[];
  note?: string;
}

export const ExploreFeed = ({ listings, note }: ExploreFeedProps) => {
  const [activeZone, setActiveZone] = useState<string | undefined>();
  const [sortMode, setSortMode] = useState<SortMode>("match");

  const zones = Array.from(new Set(listings.map((listing) => listing.neighborhood)));

  const filtered = listings.filter((listing) => !activeZone || listing.neighborhood === activeZone);

  const sorted = [...filtered].sort((a, b) =>
    sortMode === "match" ? b.matchScore - a.matchScore : a.price - b.price,
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 md:max-w-[1200px]">
      <div className="flex items-start gap-3 rounded-cards bg-snow px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <FlowAgentMark size="sm" className="mt-0.5" />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-graphite sm:text-[15px]">
            I found <strong>{listings.length} candidates</strong> that match your search across our
            partner agency network. Sorted by match — I'll let you know as soon as a new one comes
            in.
          </p>
          {note ? <p className="text-[13px] text-amber-700">{note}</p> : undefined}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <label className={filterLabelClass}>
          Neighborhood
          <select
            value={activeZone ?? ALL_ZONES}
            onChange={(event) =>
              setActiveZone(event.target.value === ALL_ZONES ? undefined : event.target.value)
            }
            className={filterSelectClass}
          >
            <option value={ALL_ZONES}>All neighborhoods ({listings.length})</option>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone} ({listings.filter((listing) => listing.neighborhood === zone).length})
              </option>
            ))}
          </select>
        </label>

        <label className={filterLabelClass}>
          Sort by
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className={filterSelectClass}
          >
            <option value="match">Best match</option>
            <option value="price-asc">Price (low to high)</option>
          </select>
        </label>
      </div>

      <CandidateCarousel
        key={`${activeZone ?? "all"}-${sortMode}`}
        listings={sorted}
        label="Candidate matches"
      />
    </div>
  );
};
