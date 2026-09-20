"use client";

import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import { CalendarPlus, Heart, PhoneOutgoing, X } from "lucide-react";
import Link from "next/link";
import { CallRings } from "~/components/flow/match/CallProgress";
import { BookedCheck } from "~/components/flow/ui/BookedCheck";
import { FlowButton } from "~/components/flow/ui/Button";
import { FlowPill } from "~/components/flow/ui/Pill";
import { FlowScoreBadge } from "~/components/flow/ui/ScoreBadge";
import type { FlowListing } from "~/lib/flow/types";
import { useViewingBooking } from "~/lib/flow/use-viewing-booking";
import { cn } from "~/lib/utils";

interface CandidateCardProps {
  listing: FlowListing;
  saved?: boolean;
  busy?: boolean;
  onToggleSave?: (listingId: string, saved: boolean) => Promise<boolean>;
  onDismiss?: (listingId: string) => Promise<boolean>;
}

const VISIBLE_TAGS = 4;

const slotFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Madrid",
});

const iconButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-full border border-cloud bg-snow text-iron transition-colors hover:bg-card-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian disabled:cursor-not-allowed disabled:opacity-40";

const statusPillClass =
  "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-buttons bg-card-subtle px-3 text-[13px] font-medium text-graphite";

// Quick "book a visit" from the card: the same state machine as the detail page
// gate, never live (the live opt-in stays on the detail page).
const BookVisitAction = ({ listingId }: { listingId: string }) => {
  const { call, booking, phase, start, restore, retryBooking } = useViewingBooking(listingId);
  useMountEffect(function restoreReceipts() {
    restore();
  });

  if (phase === "booked" && booking.status === "booked") {
    return (
      <p className={statusPillClass}>
        <BookedCheck size="sm" />
        <span className="truncate">
          Booked · {slotFormatter.format(new Date(booking.result.slotIso))}
        </span>
      </p>
    );
  }
  if (phase === "awaiting") {
    return (
      <p className={statusPillClass}>
        <PhoneOutgoing size={16} aria-hidden className="shrink-0 text-ember" />
        <span className="truncate">Call in progress</span>
      </p>
    );
  }
  const pending = phase === "calling" || phase === "booking";
  const unrecoverable = call.status === "failed" && !call.retryable;
  return (
    <FlowButton
      className="min-w-0 flex-1"
      disabled={pending || unrecoverable}
      onClick={() => void (booking.status === "failed" ? retryBooking() : start())}
    >
      {phase === "calling" ? (
        <span className="relative flex size-4 shrink-0 items-center justify-center">
          <CallRings className="absolute inset-0" />
          <span className="size-2 rounded-full bg-snow" />
        </span>
      ) : (
        <CalendarPlus size={16} aria-hidden className="shrink-0" />
      )}
      <span className="truncate">
        {phase === "calling"
          ? "Calling…"
          : phase === "booking"
            ? "Booking…"
            : phase === "failed"
              ? "Couldn't reach · try again"
              : "Book a visit"}
      </span>
    </FlowButton>
  );
};

export const CandidateCard = ({
  listing,
  saved = false,
  busy = false,
  onToggleSave,
  onDismiss,
}: CandidateCardProps) => {
  const visibleTags = listing.tags.slice(0, VISIBLE_TAGS);
  const hiddenTags = listing.tags.length - visibleTags.length;

  return (
    <article className="flex h-full w-full flex-col overflow-hidden rounded-cards bg-snow shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/explore/${encodeURIComponent(listing.id)}`}
        className="group flex flex-1 flex-col focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-obsidian"
      >
        <div className="relative h-48 w-full shrink-0 bg-mist">
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt={listing.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-mist" />
          )}
          <FlowScoreBadge
            score={listing.matchScore}
            className="absolute top-4 left-4 shadow-[0_1px_8px_rgba(0,0,0,0.18)]"
          />
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5 sm:p-7">
          <div>
            <h3 className="text-subheading line-clamp-2 min-h-12 font-semibold text-obsidian">
              {listing.title}
            </h3>
            <p className="mt-1 line-clamp-1 text-[14px] text-fog">
              {listing.neighborhood}, {listing.city} ·{" "}
              {listing.sizeM2 > 0 ? `${listing.sizeM2} m²` : "Area unknown"} ·{" "}
              {listing.rooms > 0 ? `${listing.rooms} bd` : "Bedrooms unknown"}
            </p>
          </div>

          <p className="text-[20px] font-semibold text-obsidian">
            {listing.price > 0 ? (
              <>
                €{listing.price} <span className="text-[13px] font-normal text-fog">/month</span>
              </>
            ) : (
              "Price unknown"
            )}
          </p>

          <div className="mt-auto flex min-h-16 flex-wrap content-start gap-2">
            {visibleTags.map((tag) => (
              <FlowPill key={tag}>{tag}</FlowPill>
            ))}
            {hiddenTags > 0 ? <FlowPill>+{hiddenTags}</FlowPill> : undefined}
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 border-t border-cloud px-5 py-4 sm:px-7">
        <BookVisitAction listingId={listing.id} />
        {onToggleSave ? (
          <button
            type="button"
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved" : "Save this listing"}
            disabled={busy}
            onClick={() => void onToggleSave(listing.id, !saved)}
            className={iconButtonClass}
          >
            <Heart size={18} aria-hidden className={cn(saved && "fill-ember text-ember")} />
          </button>
        ) : undefined}
        {onDismiss ? (
          <button
            type="button"
            aria-label="Discard this candidate"
            disabled={busy}
            onClick={() => void onDismiss(listing.id)}
            className={iconButtonClass}
          >
            <X size={18} aria-hidden />
          </button>
        ) : undefined}
      </div>
    </article>
  );
};
