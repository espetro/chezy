"use client";

import { useState } from "react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { CandidateCarousel } from "~/components/flow/explore/CandidateCarousel";
import type { FlowListing } from "~/lib/flow/types";
import { cn } from "~/lib/utils";

type SortMode = "match" | "price-asc";

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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-10 md:px-8">
      <div className="flex items-start gap-3 rounded-cards bg-snow px-6 py-5 shadow-sm">
        <FlowAgentMark size="sm" className="mt-0.5" />
        <div className="flex flex-col gap-1.5">
          <p className="text-[15px] text-graphite">
            I found <strong>{listings.length} candidates</strong> that match your search across our
            partner agency network. Sorted by match — I'll let you know as soon as a new one comes
            in.
          </p>
          {note ? <p className="text-[13px] text-amber-700">{note}</p> : undefined}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveZone(undefined)}
            className={cn(
              "rounded-pills border px-4 py-2 text-[13px]",
              !activeZone
                ? "border-obsidian bg-obsidian text-snow"
                : "border-mist bg-snow text-graphite hover:border-iron",
            )}
          >
            All neighborhoods
          </button>
          {zones.map((zone) => (
            <button
              key={zone}
              type="button"
              onClick={() => setActiveZone(zone)}
              className={cn(
                "rounded-pills border px-4 py-2 text-[13px]",
                activeZone === zone
                  ? "border-obsidian bg-obsidian text-snow"
                  : "border-mist bg-snow text-graphite hover:border-iron",
              )}
            >
              {zone}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-[13px] text-fog">
          Sort by
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="rounded-inputs border border-mist bg-snow px-3 py-2 text-[13px] text-graphite outline-none focus-visible:ring-2 focus-visible:ring-obsidian"
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
