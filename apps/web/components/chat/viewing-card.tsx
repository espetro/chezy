"use client";

import type { BookingResult, ViewingResult } from "@chezy/contract";
import { CalendarCheckIcon, PhoneIcon } from "lucide-react";

import type { ListingSummary } from "~/lib/listings";

export interface ArrangeViewingOutput {
  readonly listing: ListingSummary;
  readonly viewing: ViewingResult;
  readonly booking?: BookingResult;
  readonly viewingId: string;
}

const slotFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const formatSlot = (iso: string | undefined) => {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : slotFormatter.format(date);
};

export function ViewingCard({ result }: { result: ArrangeViewingOutput }) {
  const { listing, viewing, booking } = result;
  const slot = formatSlot(
    booking?.slotIso ?? (viewing.status === "mock" ? viewing.slotIso : undefined),
  );
  const booked = booking?.status === "booked";

  return (
    <div className="w-[min(100%,450px)] space-y-2 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{listing.title}</p>
          <p className="text-xs text-muted-foreground">
            {[listing.neighbourhood, listing.district].filter(Boolean).join(", ")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            booked
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          }`}
        >
          {booked ? "Booked" : viewing.status === "failed" ? "Failed" : "Pending"}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <PhoneIcon className="size-3 shrink-0" />
        <span>
          Called via {viewing.channel}
          {viewing.status === "dispatched" && viewing.channel === "slng"
            ? " — live call in progress"
            : ""}
        </span>
      </div>

      {slot && (
        <div className="flex items-center gap-2 text-xs">
          <CalendarCheckIcon className="size-3 shrink-0" />
          <span>Visit {slot}</span>
        </div>
      )}

      {viewing.detail && <p className="text-[10px] text-muted-foreground">{viewing.detail}</p>}
    </div>
  );
}
