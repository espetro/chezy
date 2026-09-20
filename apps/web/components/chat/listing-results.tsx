"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { CheckIcon, HouseIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { FlowScoreBadge } from "~/components/flow/ui/ScoreBadge";
import type { ScoredListingSummary } from "~/lib/ai/tools/search-listings";
import type { ListingSummary } from "~/lib/listings";
import type { ChatMessage } from "~/lib/types";
import { safeHttpUrl } from "~/lib/utils";

const priceFormatter = new Intl.NumberFormat("en-GB", {
  currency: "EUR",
  maximumFractionDigits: 0,
  style: "currency",
  useGrouping: "always",
});

export interface ListingSearchOutput {
  readonly listings: ScoredListingSummary[];
  readonly total: number;
  readonly relaxed: readonly string[];
  readonly note?: string;
  readonly topMatches: readonly string[];
}

type SendMessage = UseChatHelpers<ChatMessage>["sendMessage"];

const sendVerdict = (sendMessage: SendMessage, text: string) => {
  sendMessage({
    parts: [{ text, type: "text" }],
    role: "user",
  });
};

export function ListingCard({
  listing,
  onAccept,
  onReject,
  rejected,
  reasons,
  score,
}: {
  listing: ListingSummary;
  onAccept?: () => void;
  onReject?: (reason: string) => void;
  rejected?: boolean;
  reasons?: readonly string[];
  score?: number;
}) {
  const [askingWhy, setAskingWhy] = useState(false);
  const [reason, setReason] = useState("");
  const listingUrl = safeHttpUrl(listing.url);
  const price =
    listing.priceEur != undefined
      ? `${priceFormatter.format(listing.priceEur)}${listing.operation === "rent" ? "/month" : ""}`
      : undefined;
  const headline = [
    listing.rooms != undefined ? `${listing.rooms} bed` : undefined,
    listing.builtM2 != undefined ? `${listing.builtM2} m²` : undefined,
    listing.bathrooms != undefined ? `${listing.bathrooms} bath` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const location = [listing.neighbourhood, listing.district].filter(Boolean).join(", ");

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm ${
        rejected ? "opacity-50" : ""
      }`}
    >
      {listing.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={listing.title}
          className="aspect-video w-full object-cover"
          src={listing.coverUrl}
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted">
          <HouseIcon className="size-8 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          {price && <p className="text-base font-semibold">{price}</p>}
          {score !== undefined && <FlowScoreBadge score={score} />}
        </div>
        {headline && <p className="text-sm font-medium">{headline}</p>}
        {location && <p className="text-xs text-muted-foreground">{location}</p>}
        <p className="line-clamp-2 text-xs text-muted-foreground">{listing.title}</p>
        {reasons && reasons.length > 0 && (
          <ul className="list-inside list-disc space-y-0.5 pt-1 text-xs text-muted-foreground">
            {reasons.slice(0, 3).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-[10px] text-muted-foreground">{listing.id}</span>
          {listingUrl && (
            <a
              className="text-xs text-primary hover:underline"
              href={listingUrl}
              rel="noreferrer"
              target="_blank"
            >
              View listing ↗
            </a>
          )}
        </div>
        {rejected ? (
          <p className="pt-1 text-xs font-medium text-muted-foreground">Rejected</p>
        ) : (
          (onAccept ?? onReject) && (
            <div className="space-y-2 pt-2">
              {askingWhy ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onReject?.(reason.trim());
                  }}
                >
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Why? (optional)"
                    type="text"
                    value={reason}
                  />
                  <button
                    className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                    type="submit"
                  >
                    Send
                  </button>
                </form>
              ) : (
                <div className="flex gap-2">
                  {onAccept && (
                    <button
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      onClick={onAccept}
                      type="button"
                    >
                      <CheckIcon className="size-3" /> Accept
                    </button>
                  )}
                  {onReject && (
                    <button
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"
                      onClick={() => setAskingWhy(true)}
                      type="button"
                    >
                      <XIcon className="size-3" /> Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </article>
  );
}

export function ListingResults({
  result,
  rejectedIds,
  sendMessage,
}: {
  result: ListingSearchOutput;
  rejectedIds?: ReadonlySet<string>;
  sendMessage?: SendMessage;
}) {
  const districts = new Set(result.listings.map((l) => l.district).filter(Boolean));
  const sharedDistrict = districts.size === 1 ? [...districts][0] : undefined;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {result.total} {result.total === 1 ? "listing" : "listings"}
        {sharedDistrict ? ` · ${sharedDistrict}` : " in Barcelona"}
      </p>
      {result.relaxed.length > 0 && (
        <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {result.note}
        </div>
      )}
      {result.listings.length === 0 ? (
        <div className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
          No listings match right now.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onAccept={
                sendMessage
                  ? () => sendVerdict(sendMessage, `Accepted listing ${listing.id}`)
                  : undefined
              }
              onReject={
                sendMessage
                  ? (reason) =>
                      sendVerdict(
                        sendMessage,
                        reason
                          ? `Rejected listing ${listing.id}: ${reason}`
                          : `Rejected listing ${listing.id}`,
                      )
                  : undefined
              }
              reasons={listing.reasons}
              rejected={rejectedIds?.has(listing.id)}
              score={listing.score}
            />
          ))}
        </div>
      )}
    </div>
  );
}
