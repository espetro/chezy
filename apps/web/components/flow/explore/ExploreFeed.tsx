"use client";

import { ArrowUpDown } from "lucide-react";
import type { FeedbackEvent, FeedbackReason } from "@chezy/contract";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { describeFeedback } from "~/lib/feedback-ranking";
import { useListingFeedback } from "~/lib/flow/use-listing-feedback";
import { useSavedListings } from "~/lib/flow/use-saved-listings";
import { useRef, useState } from "react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { FlowButton } from "~/components/flow/ui/Button";
import { FlowDropdown, FlowMultiDropdown } from "~/components/flow/ui/Dropdown";
import { CandidateCarousel } from "~/components/flow/explore/CandidateCarousel";
import type { FlowListing } from "~/lib/flow/types";

type SortMode = "match" | "price-asc";

// Offered after a card-level X so the rerank can still learn a specific reason.
const refineOptions: readonly { reason: FeedbackReason; label: string }[] = [
  { reason: "too_expensive", label: "Too expensive" },
  { reason: "wrong_area", label: "Wrong area" },
  { reason: "missing_balcony", label: "Missing balcony" },
];

const sortOptions = [
  { value: "match" as const, label: "Best match" },
  { value: "price-asc" as const, label: "Price (low to high)" },
];

interface ExploreFeedProps {
  listings: FlowListing[];
  note?: string;
  feedback?: FeedbackEvent[];
  savedIds?: string[];
}

export const ExploreFeed = ({
  listings,
  note,
  feedback = [],
  savedIds: initialSavedIds = [],
}: ExploreFeedProps) => {
  const feedRef = useRef<HTMLDivElement>(null);
  const [activeZones, setActiveZones] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("match");
  const router = useRouter();
  const { reject, undo, refine, busy, error } = useListingFeedback(() => router.refresh());
  const { savedIds, toggleSave, error: saveError } = useSavedListings(initialSavedIds);
  const lastDismissed = feedback.at(-1);

  const zones = Array.from(
    new Set([...activeZones, ...listings.map((listing) => listing.neighborhood)]),
  );

  const zoneOptions = zones.map((zone) => ({
    value: zone,
    label: `${zone} (${listings.filter((listing) => listing.neighborhood === zone).length})`,
  }));

  const filtered = listings.filter(
    (listing) => activeZones.length === 0 || activeZones.includes(listing.neighborhood),
  );

  const sorted = [...filtered].sort((a, b) => (sortMode === "match" ? 0 : a.price - b.price));

  return (
    <div
      ref={feedRef}
      tabIndex={-1}
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 md:max-w-[1200px]"
    >
      <div className="flex items-start gap-3 rounded-cards bg-snow px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <FlowAgentMark size="sm" className="mt-0.5" />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-graphite sm:text-[15px]">
            I found <strong>{listings.length} candidates</strong> that match your search across our
            partner agency network. Sorted by match and your feedback.
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
        savedIds={savedIds}
        onToggleSave={toggleSave}
        onDismiss={(listingId) => reject(listingId, "not_interested")}
        busy={busy}
      />
      {lastDismissed && (
        <div className="flex flex-col gap-3 rounded-cards bg-snow px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="text-sm text-fog">
              {describeFeedback(lastDismissed)}
            </p>
            <FlowButton
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                if (await undo(lastDismissed.eventId)) feedRef.current?.focus();
              }}
            >
              Undo
            </FlowButton>
          </div>
          {lastDismissed.reason === "not_interested" && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Refine the reason">
              <span className="text-[13px] text-fog">Why? (optional)</span>
              {refineOptions.map(({ reason, label }) => (
                <FlowButton
                  key={reason}
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void refine(lastDismissed.eventId, reason)}
                >
                  {label}
                </FlowButton>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {saveError && <p role="alert">{saveError}</p>}
      {busy && <p role="status">Updating your comparison…</p>}
      {sorted.length === 0 && (
        <div className="rounded-cards bg-snow p-4">
          <p>
            No homes remain with these filters and rejections. Undo your last rejection or edit your
            preferences to see the trade-off.
          </p>
          <Link href="/onboarding" className="inline-flex min-h-11 items-center underline">
            Edit preferences
          </Link>
        </div>
      )}
    </div>
  );
};
