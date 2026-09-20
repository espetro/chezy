"use client";

import { ArrowUpDown } from "lucide-react";
import type { AdaptationJob, FeedbackEvent, FeedbackReason } from "@chezy/contract";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ResolvedPanel } from "~/lib/adaptation/resolve";
import { describeFeedback } from "~/lib/feedback-ranking";
import { requestAdaptation } from "~/lib/flow/adaptation-client";
import { useListingFeedback } from "~/lib/flow/use-listing-feedback";
import { useSavedListings } from "~/lib/flow/use-saved-listings";
import { useChatLauncher } from "~/components/flow/ui/ChatLauncher";
import { useRef, useState } from "react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { FlowButton } from "~/components/flow/ui/Button";
import { FlowDropdown, FlowMultiDropdown } from "~/components/flow/ui/Dropdown";
import { CandidateCarousel } from "~/components/flow/explore/CandidateCarousel";
import { AdaptationStatus } from "~/components/flow/explore/AdaptationStatus";
import { FlowChatBar } from "~/components/flow/explore/ChatBar";
import { ComparisonPanel } from "~/components/flow/explore/ComparisonPanel";
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
  panel?: { panel: ResolvedPanel; job: AdaptationJob };
  job?: AdaptationJob;
  savedIds?: string[];
}

export const ExploreFeed = ({
  listings,
  note,
  feedback = [],
  panel,
  job,
  savedIds: initialSavedIds = [],
}: ExploreFeedProps) => {
  const feedRef = useRef<HTMLDivElement>(null);
  const [activeZones, setActiveZones] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("match");
  const router = useRouter();
  // Aborts the fire-and-forget comparison request when a faster Undo undoes it.
  const adaptationRequest = useRef<AbortController | undefined>(undefined);
  const { reject, undo, refine, busy, error } = useListingFeedback((event) => {
    adaptationRequest.current?.abort();
    const controller = new AbortController();
    adaptationRequest.current = controller;
    void requestAdaptation(event, controller.signal).finally(() => router.refresh());
  });
  const { savedIds, toggleSave, error: saveError } = useSavedListings(initialSavedIds);
  const lastDismissed = feedback.at(-1);
  const { reset: resetChat } = useChatLauncher();
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

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
  // Derived: falls back to the first visible card when filters or rejections hide the active one.
  const activeListing = sorted.find((listing) => listing.id === activeId) ?? sorted[0];
  // The chat thread belongs to the listing in view: moving the carousel drops it.
  const onActiveChange = (listing: FlowListing | undefined) => {
    if (listing?.id === activeListing?.id) return;
    setActiveId(listing?.id);
    resetChat();
  };

  return (
    <div
      ref={feedRef}
      tabIndex={-1}
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 px-4 pt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:gap-8 sm:px-6 sm:pt-10 md:max-w-[1200px]"
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
        onDismiss={(listingId) => reject(listingId, "other")}
        onActiveChange={onActiveChange}
        busy={busy}
      />
      {job && job.jobId !== panel?.job.jobId ? <AdaptationStatus job={job} /> : undefined}
      {panel ? <ComparisonPanel panel={panel.panel} job={panel.job} /> : undefined}
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
                adaptationRequest.current?.abort();
                if (await undo(lastDismissed.eventId)) feedRef.current?.focus();
              }}
            >
              Undo
            </FlowButton>
          </div>
          {lastDismissed.reason === "other" && (
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
      <FlowChatBar context={activeListing} />
    </div>
  );
};
