"use client";

import { ArrowUp, CalendarCheck, CalendarPlus, Heart, PhoneOutgoing, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { FlowButton } from "~/components/flow/ui/Button";
import { useChatLauncher } from "~/components/flow/ui/ChatLauncher";
import { FlowPill } from "~/components/flow/ui/Pill";
import { FlowScoreBadge } from "~/components/flow/ui/ScoreBadge";
import type { FlowListing } from "~/lib/flow/types";
import { cn } from "~/lib/utils";
import { createViewingController, type ViewingState } from "~/lib/viewing";

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

// Quick "book a visit" from the card: the same viewing controller as the detail
// page gate, never live (the live opt-in stays on the detail page), and the
// result is labelled truthfully (mock mode simulates, nothing is booked).
const BookVisitAction = ({ listingId }: { listingId: string }) => {
  const [state, setState] = useState<ViewingState>({ status: "idle" });
  const controller = useRef<ReturnType<typeof createViewingController> | undefined>(undefined);

  const book = async () => {
    controller.current ??= createViewingController(listingId, {
      getItem: (key) => localStorage.getItem(key) ?? undefined,
      setItem: (key, value) => localStorage.setItem(key, value),
    });
    const pending = controller.current.start(false);
    setState({ status: "dispatching" });
    setState(await pending);
  };

  if (state.status === "simulated") {
    return (
      <p
        className={statusPillClass}
        title="Simulated example viewing. No phone call or calendar booking was made."
      >
        <CalendarCheck size={16} aria-hidden className="shrink-0 text-ember" />
        <span className="truncate">
          Simulated · {slotFormatter.format(new Date(state.result.slotIso))}
        </span>
      </p>
    );
  }
  if (state.status === "dispatched") {
    return (
      <p
        className={statusPillClass}
        title="Awaiting agency confirmation. No appointment is booked."
      >
        <PhoneOutgoing size={16} aria-hidden className="shrink-0 text-ember" />
        <span className="truncate">Call requested · awaiting confirmation</span>
      </p>
    );
  }
  const failed = state.status === "failed";
  return (
    <FlowButton
      className="min-w-0 flex-1"
      disabled={state.status === "dispatching" || (failed && !state.retryable)}
      onClick={() => void book()}
    >
      <CalendarPlus size={16} aria-hidden className="shrink-0" />
      <span className="truncate">
        {state.status === "dispatching"
          ? "Calling the agency…"
          : failed
            ? "Call failed · try again"
            : "Book a visit"}
      </span>
    </FlowButton>
  );
};

// "Ask about this home": opens the chat drawer with the listing pinned as the
// first message so the chat tools can resolve it by id.
const AskAboutListing = ({ listing }: { listing: FlowListing }) => {
  const { open } = useChatLauncher();
  const [question, setQuestion] = useState("");
  const trimmed = question.trim();
  const price = listing.price > 0 ? `€${listing.price}/month` : "price unknown";

  return (
    <form
      className="flex items-center gap-2 border-t border-cloud px-5 py-3 sm:px-7"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed) return;
        open({
          subject: listing.title,
          message: `Regarding listing ${listing.id} ("${listing.title}", ${listing.neighborhood}, ${price}): ${trimmed}`,
        });
        setQuestion("");
      }}
    >
      <input
        type="text"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        maxLength={500}
        aria-label={`Ask Chezy about ${listing.title}`}
        placeholder="Ask about this home…"
        className="min-h-11 min-w-0 flex-1 rounded-buttons bg-paper px-3 text-[14px] text-obsidian placeholder:text-fog focus-visible:outline-2 focus-visible:outline-obsidian"
      />
      <button
        type="submit"
        aria-label="Ask Chezy"
        disabled={!trimmed}
        className={cn(iconButtonClass, "bg-obsidian text-snow hover:bg-graphite")}
      >
        <ArrowUp size={18} aria-hidden />
      </button>
    </form>
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
      <AskAboutListing listing={listing} />
    </article>
  );
};
