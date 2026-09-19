"use client";

import { CalendarCheck, CalendarPlus, Heart, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FlowButton } from "~/components/flow/ui/Button";
import { FlowPill } from "~/components/flow/ui/Pill";
import { FlowScoreBadge } from "~/components/flow/ui/ScoreBadge";
import type { FlowListing } from "~/lib/flow/types";
import { cn } from "~/lib/utils";

interface CandidateCardProps {
  listing: FlowListing;
}

interface ViewingResponse {
  status?: "mock" | "dispatched" | "failed";
  slotIso?: string;
  detail?: string;
}

type ContactStatus = "idle" | "calling" | "booked" | "failed";

const VISIBLE_TAGS = 4;

const slotFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Madrid",
});

const iconButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-full border border-cloud bg-snow text-iron transition-colors hover:bg-card-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian";

export const CandidateCard = ({ listing }: CandidateCardProps) => {
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [slotLabel, setSlotLabel] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  const visibleTags = listing.tags.slice(0, VISIBLE_TAGS);
  const hiddenTags = listing.tags.length - visibleTags.length;

  const contactAgency = async () => {
    setStatus("calling");
    try {
      const response = await fetch("/api/viewing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyRef: listing.id }),
      });
      const data: ViewingResponse = await response.json().catch(() => ({}));
      if (response.ok && data.status !== "failed") {
        setSlotLabel(data.slotIso ? slotFormatter.format(new Date(data.slotIso)) : undefined);
        setStatus("booked");
      } else {
        setStatus("failed");
      }
    } catch {
      setStatus("failed");
    }
  };

  const contactLabel =
    status === "calling"
      ? "Calling the agency…"
      : status === "failed"
        ? "Call failed · try again"
        : "Book a visit";

  return (
    <article className="flex h-full w-full flex-col overflow-hidden rounded-cards bg-snow shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/explore/${encodeURIComponent(listing.id)}`}
        className={cn(
          "flex flex-1 flex-col focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-obsidian",
          discarded && "opacity-40",
        )}
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

        <div className="flex flex-1 flex-col gap-3 p-5 sm:px-7 sm:pt-7">
          <div>
            <h3 className="text-subheading line-clamp-2 min-h-12 font-semibold text-obsidian">
              {listing.title}
            </h3>
            <p className="mt-1 line-clamp-1 text-[14px] text-fog">
              {listing.neighborhood}, {listing.city} · {listing.sizeM2} m² · {listing.rooms} bd
            </p>
          </div>

          <p className="text-[20px] font-semibold text-obsidian">
            €{listing.price} <span className="text-[13px] font-normal text-fog">/month</span>
          </p>

          <p className="line-clamp-2 min-h-14 rounded-[14px] bg-card-subtle px-3 py-2 text-[13px] text-iron">
            {listing.matchReasons[0]?.label ?? "Open this home to review known facts and unknowns."}
          </p>
          {listing.outdoorEvidence && (
            <p className="text-[13px] text-iron">{listing.outdoorEvidence}</p>
          )}

          <div className="mt-auto flex min-h-16 flex-wrap content-start gap-2">
            {visibleTags.map((tag) => (
              <FlowPill key={tag}>{tag}</FlowPill>
            ))}
            {hiddenTags > 0 ? <FlowPill>+{hiddenTags}</FlowPill> : undefined}
          </div>
        </div>
      </Link>

      {discarded ? (
        <div className="flex items-center justify-between gap-3 border-t border-cloud px-5 py-4 sm:px-7">
          <p className="text-[13px] text-fog">Candidate discarded.</p>
          <FlowButton variant="ghost" size="sm" onClick={() => setDiscarded(false)}>
            Undo
          </FlowButton>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-cloud px-5 py-4 sm:px-7">
          {status === "booked" ? (
            <p className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-buttons bg-card-subtle px-3 text-[13px] font-medium text-graphite">
              <CalendarCheck size={16} aria-hidden className="shrink-0 text-ember" />
              <span className="truncate">
                {slotLabel ? `Visit booked · ${slotLabel}` : "Visit booked"}
              </span>
            </p>
          ) : (
            <FlowButton
              className="min-w-0 flex-1"
              disabled={status === "calling"}
              onClick={() => void contactAgency()}
            >
              <CalendarPlus size={16} aria-hidden className="shrink-0" />
              <span className="truncate">{contactLabel}</span>
            </FlowButton>
          )}
          <button
            type="button"
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved" : "Save this listing"}
            onClick={() => setSaved(!saved)}
            className={iconButtonClass}
          >
            <Heart size={18} aria-hidden className={cn(saved && "fill-ember text-ember")} />
          </button>
          <button
            type="button"
            aria-label="Discard this candidate"
            onClick={() => setDiscarded(true)}
            className={iconButtonClass}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      )}
    </article>
  );
};
