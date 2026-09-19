"use client";

import { ArrowUpDown } from "lucide-react";
import { useRef, useState } from "react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { FlowButton } from "~/components/flow/ui/Button";
import { FlowDropdown, FlowMultiDropdown } from "~/components/flow/ui/Dropdown";
import { CandidateCarousel } from "~/components/flow/explore/CandidateCarousel";
import type { FlowListing } from "~/lib/flow/types";
import { useCandidateDismissal } from "~/lib/flow/use-candidate-dismissal";

type SortMode = "match" | "price-asc";

const sortOptions = [
  { value: "match" as const, label: "Best match" },
  { value: "price-asc" as const, label: "Price (low to high)" },
];

interface ExploreFeedProps {
  listings: FlowListing[];
  note?: string;
}

export const ExploreFeed = ({ listings, note }: ExploreFeedProps) => {
  const feedRef = useRef<HTMLDivElement>(null);
  const [activeZones, setActiveZones] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("match");
  const { dismissedIds, dismissCandidate, restoreCandidate } = useCandidateDismissal();
  const lastDismissed = dismissedIds.at(-1);

  const zones = Array.from(new Set(listings.map((listing) => listing.neighborhood)));

  const zoneOptions = zones.map((zone) => ({
    value: zone,
    label: `${zone} (${listings.filter((listing) => listing.neighborhood === zone).length})`,
  }));

  const filtered = listings.filter(
    (listing) =>
      !dismissedIds.includes(listing.id) &&
      (activeZones.length === 0 || activeZones.includes(listing.neighborhood)),
  );

  const sorted = [...filtered].sort((a, b) =>
    sortMode === "match" ? b.matchScore - a.matchScore : a.price - b.price,
  );

  return (
    <div
      ref={feedRef}
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 md:max-w-[1200px]"
    >
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

      <div className="flex items-center gap-2">
        <FlowMultiDropdown
          label="Neighborhoods"
          className="min-w-0 flex-1 sm:max-w-xs"
          values={activeZones}
          options={zoneOptions}
          onChange={setActiveZones}
          emptyLabel={`All neighborhoods (${listings.length})`}
          selectionLabel={(count) => `${count} neighborhoods`}
        />
        <FlowDropdown
          label="Sort by"
          compact
          align="end"
          icon={<ArrowUpDown size={16} aria-hidden />}
          value={sortMode}
          options={sortOptions}
          onChange={setSortMode}
        />
      </div>

      <CandidateCarousel
        key={`${activeZones.join(",") || "all"}-${sortMode}`}
        listings={sorted}
        label="Candidate matches"
        onDismiss={dismissCandidate}
      />
      {lastDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-cards bg-snow px-4 py-3">
          <p role="status" className="text-sm text-fog">
            Candidate hidden for this visit.
          </p>
          <FlowButton
            variant="ghost"
            onClick={() => {
              restoreCandidate(lastDismissed);
              requestAnimationFrame(() => {
                feedRef.current
                  ?.querySelector<HTMLAnchorElement>(
                    `[data-listing-id="${CSS.escape(lastDismissed)}"] a`,
                  )
                  ?.focus();
              });
            }}
          >
            Undo
          </FlowButton>
        </div>
      )}
    </div>
  );
};
