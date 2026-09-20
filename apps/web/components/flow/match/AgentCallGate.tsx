"use client";

import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import type { FeedbackEvent } from "@chezy/contract";
import Link from "next/link";
import { useRef, useState } from "react";
import { RejectionControl } from "~/components/flow/explore/RejectionControl";
import { CallProgress } from "~/components/flow/match/CallProgress";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { BookedCheck } from "~/components/flow/ui/BookedCheck";
import { FlowButton } from "~/components/flow/ui/Button";
import { FlowStateTransition } from "~/components/flow/ui/FlowMotion";
import { FlowPill } from "~/components/flow/ui/Pill";
import { requestAdaptation } from "~/lib/flow/adaptation-client";
import { AUTO_CALL_MATCH_THRESHOLD } from "~/lib/flow/constants";
import type { FlowListing } from "~/lib/flow/types";
import { useListingFeedback } from "~/lib/flow/use-listing-feedback";
import { useViewingBooking } from "~/lib/flow/use-viewing-booking";

interface AgentCallGateProps {
  listing: FlowListing;
  onDismiss?: (listingId: string) => void;
}

const slotFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Madrid",
});

const autoCallKey = (listingId: string) => `chezy:autocall:${listingId}`;

const CallGate = ({ listing, onDismiss }: AgentCallGateProps) => {
  const isAutoCall = listing.matchScore >= AUTO_CALL_MATCH_THRESHOLD;
  const { call, booking, phase, stage, transcript, slotIso, start, restore, retryBooking } =
    useViewingBooking(listing.id);
  const [feedback, setFeedback] = useState<FeedbackEvent>();
  // Aborts the fire-and-forget comparison request when a faster Undo undoes it.
  const adaptationRequest = useRef<AbortController | undefined>(undefined);
  const { reject, undo, busy, error } = useListingFeedback((event) => {
    setFeedback(event);
    adaptationRequest.current?.abort();
    const controller = new AbortController();
    adaptationRequest.current = controller;
    void requestAdaptation(event, controller.signal);
  });
  const restoreFocus = useRef(false);
  const canCall = call.status === "idle";
  const startCall = () => void start();

  useMountEffect(function autoCallOnMount() {
    const restored = restore();
    if (restored.call.status !== "idle" || restored.booking.status !== "idle" || !isAutoCall) {
      return;
    }
    try {
      if (localStorage.getItem(autoCallKey(listing.id))) return;
      localStorage.setItem(autoCallKey(listing.id), new Date().toISOString());
    } catch {
      // Automatic requests only simulate; blocked storage cannot cause a live call.
    }
    startCall();
  });

  if (feedback && !feedback.undoneAt) {
    return (
      <div
        ref={(node) => node?.querySelector("button")?.focus({ preventScroll: true })}
        className="flex min-h-[22rem] flex-col items-start justify-center gap-4 rounded-cards bg-snow p-5 shadow-sm sm:p-7"
      >
        <p role="status">Candidate rejected. Your comparison has been updated.</p>
        <FlowButton
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            restoreFocus.current = true;
            adaptationRequest.current?.abort();
            if (!(await undo(feedback.eventId))) restoreFocus.current = false;
          }}
        >
          Undo
        </FlowButton>
        <Link href="/explore" className="inline-flex min-h-11 items-center underline">
          See updated comparison
        </Link>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }

  const failedDetail =
    booking.status === "failed"
      ? booking.detail
      : call.status === "failed"
        ? call.detail
        : undefined;
  const canRetry = booking.status === "failed" || (call.status === "failed" && call.retryable);

  return (
    <div
      tabIndex={-1}
      ref={(node) => {
        if (node && restoreFocus.current) {
          node.focus({ preventScroll: true });
          restoreFocus.current = false;
        }
      }}
      className="flex flex-col gap-4 rounded-cards bg-snow p-5 shadow-sm focus-visible:outline-2 focus-visible:outline-obsidian sm:p-6"
    >
      <div className="flex items-start gap-3">
        <FlowAgentMark size="sm" className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-medium text-obsidian">Chezy agent</p>
            {call.status === "simulated" ? <FlowPill>Demo</FlowPill> : undefined}
          </div>
          <p className="text-[13px] text-fog">
            {isAutoCall
              ? `Matched above ${AUTO_CALL_MATCH_THRESHOLD}%, so Chezy called the agency on its own.`
              : `${listing.matchScore}% match. Below Chezy's ${AUTO_CALL_MATCH_THRESHOLD}% bar to call alone; you can start the call.`}
          </p>
        </div>
      </div>

      <div
        className="flex min-h-[11rem] flex-col justify-center rounded-[16px] bg-paper p-4 focus-visible:outline-2 focus-visible:outline-obsidian"
        tabIndex={0}
        role="status"
        aria-live="polite"
      >
        <FlowStateTransition state={phase}>
          {phase === "idle" ? (
            <p className="text-[14px] text-iron">Ready to call the agency for you.</p>
          ) : phase === "calling" ? (
            <CallProgress
              agency={listing.agency}
              stage={stage}
              slotIso={slotIso}
              transcript={transcript}
            />
          ) : phase === "booking" ? (
            <div className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-ember motion-reduce:animate-none" />
              <p className="text-[14px] font-medium text-graphite">Booking the visit…</p>
            </div>
          ) : phase === "booked" && booking.status === "booked" ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <BookedCheck size="lg" />
              <div>
                <p className="text-[17px] font-semibold text-obsidian">Visit booked</p>
                <p className="mt-1 text-[15px] text-graphite">
                  {slotFormatter.format(new Date(booking.result.slotIso))}
                </p>
                <p className="mt-2 text-[13px] text-fog">
                  {listing.title} · {listing.neighborhood}
                </p>
                <p className="text-[13px] text-fog">30 min · added to your calendar</p>
              </div>
            </div>
          ) : phase === "failed" ? (
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-medium text-graphite">Couldn't reach the agency</p>
              <p className="text-[13px] text-fog">{failedDetail}</p>
            </div>
          ) : undefined}
        </FlowStateTransition>
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:content-start sm:gap-3">
        {canCall ? (
          <FlowButton className="w-full sm:w-auto" onClick={() => startCall()}>
            Call the agency
          </FlowButton>
        ) : undefined}
        {canRetry ? (
          <FlowButton
            className="w-full sm:w-auto"
            onClick={() => (booking.status === "failed" ? void retryBooking() : startCall())}
          >
            Try again
          </FlowButton>
        ) : undefined}
        <RejectionControl
          listingId={listing.id}
          title={listing.title}
          disabled={phase === "calling" || phase === "booking" || busy}
          onReject={async (listingId, reason) => {
            const saved = await reject(listingId, reason);
            if (saved) onDismiss?.(listingId);
            return saved;
          }}
        />
        {error && <p role="alert">{error}</p>}
        {busy && <p role="status">Updating your comparison…</p>}
      </div>
    </div>
  );
};

export const AgentCallGate = ({ listing, onDismiss }: AgentCallGateProps) => (
  <CallGate key={listing.id} listing={listing} onDismiss={onDismiss} />
);
