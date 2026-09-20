"use client";

import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import type { FeedbackEvent } from "@chezy/contract";
import Link from "next/link";
import { useRef, useState } from "react";
import { RejectionControl } from "~/components/flow/explore/RejectionControl";
import { useListingFeedback } from "~/lib/flow/use-listing-feedback";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { FlowBadge } from "~/components/flow/ui/Badge";
import { FlowButton } from "~/components/flow/ui/Button";
import { FlowStateTransition } from "~/components/flow/ui/FlowMotion";
import { appendActivity, useLatestCallActivity } from "~/lib/flow/agent-activity";
import { claimAutoCall } from "~/lib/flow/agent-call";
import { AUTO_CALL_MATCH_THRESHOLD } from "~/lib/flow/constants";
import type { FlowListing } from "~/lib/flow/types";
import { createViewingController, type ViewingState } from "~/lib/viewing";

interface AgentCallGateProps {
  listing: FlowListing;
  onDismiss?: (listingId: string) => void;
}

const slotFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const dotDelays = ["0ms", "160ms", "320ms"];

const CallGate = ({ listing, onDismiss }: AgentCallGateProps) => {
  const isAutoCall = listing.matchScore >= AUTO_CALL_MATCH_THRESHOLD;
  const [state, setState] = useState<ViewingState>({ status: "idle" });
  // Set once this card itself claims and drives the auto-call, so its render branches to
  // the rich local `state` below instead of the coarse shared log another surface may have
  // already written (see the `sharedAutoCall` fallback further down).
  const [ownsAutoCall, setOwnsAutoCall] = useState(false);
  const sharedAutoCall = useLatestCallActivity(listing.id);
  const [feedback, setFeedback] = useState<FeedbackEvent>();
  const { reject, undo, busy, error } = useListingFeedback(setFeedback);
  const [liveOptIn, setLiveOptIn] = useState(false);
  const controller = useRef<ReturnType<typeof createViewingController> | undefined>(undefined);
  const restoreFocus = useRef(false);
  const { status } = state;
  // A retryable failure with no live attempt on record (e.g. the server
  // rejected the opt-in before dispatching) falls back to the simulate path.
  const canSimulate =
    status === "idle" || (state.status === "failed" && state.retryable && !state.live);
  const canOptInLive = canSimulate || status === "simulated";

  function getController() {
    controller.current ??= createViewingController(listing.id, {
      getItem: (key) => localStorage.getItem(key) ?? undefined,
      setItem: (key, value) => localStorage.setItem(key, value),
    });
    return controller.current;
  }

  const broadcast = (result: ViewingState) => {
    const base = { listingId: listing.id, agency: listing.agency, listingTitle: listing.title };
    if (result.status === "simulated") {
      appendActivity({
        ...base,
        id: crypto.randomUUID(),
        kind: "simulated",
        createdAt: new Date().toISOString(),
        visit: {
          slotIso: result.result.slotIso,
          label: slotFormatter.format(new Date(result.result.slotIso)),
          durationMinutes: 30,
        },
      });
    } else if (result.status === "dispatched") {
      appendActivity({
        ...base,
        id: crypto.randomUUID(),
        kind: "dispatched",
        createdAt: new Date().toISOString(),
      });
    } else if (result.status === "failed") {
      appendActivity({
        ...base,
        id: crypto.randomUUID(),
        kind: "failed",
        createdAt: new Date().toISOString(),
        error: result.detail,
      });
    }
  };

  const startCall = async (live = false) => {
    if (live) setLiveOptIn(false);
    const base = { listingId: listing.id, agency: listing.agency, listingTitle: listing.title };
    appendActivity({
      ...base,
      id: crypto.randomUUID(),
      kind: "calling",
      createdAt: new Date().toISOString(),
    });
    const pending = getController().start(live);
    setState({ status: "dispatching" });
    const result = await pending;
    setState(result);
    broadcast(result);
  };

  useMountEffect(function autoCallOnMount() {
    const restored = getController().restore();
    setState(restored);
    if (restored.status !== "idle" || !isAutoCall) return;
    if (!claimAutoCall(listing.id)) return; // another surface (the carousel banner) already owns this call
    setOwnsAutoCall(true);
    void startCall();
  });

  // If another surface already placed this listing's auto-call before this card mounted,
  // mirror its outcome here instead of showing a stale "no call requested" idle state.
  const mirroredAutoCall =
    isAutoCall && !ownsAutoCall && status === "idle" ? sharedAutoCall : undefined;

  if (feedback && !feedback.undoneAt) {
    return (
      <div
        ref={(node) => node?.querySelector("button")?.focus({ preventScroll: true })}
        className="flex min-h-[42rem] flex-col items-start justify-center gap-4 rounded-cards bg-snow p-5 shadow-sm sm:min-h-[34rem] sm:p-7"
      >
        <p role="status">Candidate rejected. Your comparison has been updated.</p>
        <FlowButton
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            restoreFocus.current = true;
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

  return (
    <div
      tabIndex={-1}
      ref={(node) => {
        if (node && restoreFocus.current) {
          node.focus({ preventScroll: true });
          restoreFocus.current = false;
        }
      }}
      className="flex min-h-[42rem] flex-col gap-4 rounded-cards bg-snow p-5 shadow-sm focus-visible:outline-2 focus-visible:outline-obsidian sm:min-h-[34rem] sm:p-7"
    >
      {isAutoCall ? (
        <div className="flex items-start gap-3">
          <FlowAgentMark size="sm" className="mt-0.5" />
          <div className="flex min-w-0 flex-col gap-1">
            <FlowBadge variant="accent" className="w-fit whitespace-normal">
              Auto-call simulation · ≥{AUTO_CALL_MATCH_THRESHOLD}% match
            </FlowBadge>
            <p className="text-[13px] text-fog">
              This match cleared the {AUTO_CALL_MATCH_THRESHOLD}% confidence bar. Rehearsal
              simulates the call; a live demo call requires your explicit approval.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <FlowAgentMark size="sm" className="mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-medium text-obsidian">{listing.matchScore}% match</p>
            <p className="text-[13px] text-fog">
              This is below my {AUTO_CALL_MATCH_THRESHOLD}% bar for calling on my own. I'll keep
              watching it, or you can simulate the call.
            </p>
          </div>
        </div>
      )}

      <div
        className="h-56 overflow-y-auto rounded-[20px] bg-paper p-5 focus-visible:outline-2 focus-visible:outline-obsidian"
        tabIndex={0}
        role="status"
        aria-live="polite"
      >
        {mirroredAutoCall ? (
          <div className="animate-fade-up">
            {mirroredAutoCall.kind === "calling" ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  {dotDelays.map((delay) => (
                    <span
                      key={delay}
                      className="size-1.5 animate-dot-pulse rounded-full bg-ember"
                      style={{ animationDelay: delay }}
                    />
                  ))}
                </span>
                <p className="text-[14px] font-medium text-graphite">
                  Calling {mirroredAutoCall.agency}…
                </p>
              </div>
            ) : mirroredAutoCall.kind === "simulated" ? (
              <div className="flex flex-col gap-1">
                <FlowBadge variant="accent" className="w-fit">
                  Simulated
                </FlowBadge>
                <p className="text-[14px] font-medium text-graphite">
                  Example viewing: {mirroredAutoCall.visit?.label}
                </p>
                <p className="text-[13px] text-fog">No phone call or calendar booking was made.</p>
              </div>
            ) : mirroredAutoCall.kind === "dispatched" ? (
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-medium text-graphite">Call requested</p>
                <p className="text-[13px] text-fog">
                  Awaiting agency confirmation. No appointment is booked.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-medium text-graphite">
                  Call request could not be confirmed
                </p>
                <p className="text-[13px] text-fog">{mirroredAutoCall.error}</p>
              </div>
            )}
          </div>
        ) : (
          <FlowStateTransition state={status}>
            {status === "idle" ? (
              <p className="text-[14px] text-iron">No call requested.</p>
            ) : status === "dispatching" ? (
              <div className="flex items-center gap-2">
                <span className="size-2 animate-pulse rounded-full bg-ember motion-reduce:animate-none" />
                <p className="text-[14px] font-medium text-graphite">Requesting call…</p>
              </div>
            ) : status === "failed" ? (
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-medium text-graphite">
                  Call request could not be confirmed
                </p>
                <p className="text-[13px] text-fog">{state.detail}</p>
              </div>
            ) : state.status === "dispatched" ? (
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-medium text-graphite">Call requested</p>
                <p className="text-[13px] text-fog">
                  Awaiting agency confirmation. No appointment is booked.
                </p>
                <p className="text-[13px] text-fog">
                  {state.result.channel.toUpperCase()} · {state.result.callId}
                </p>
                <p className="text-[13px] text-fog">
                  Request-to-dispatch: {state.result.latencyMs} ms (server receipt to provider
                  acknowledgement, including lookup). This is not conversational latency.
                </p>
              </div>
            ) : state.status === "simulated" ? (
              <div className="flex flex-col gap-1">
                <FlowBadge variant="accent" className="w-fit">
                  Simulated
                </FlowBadge>
                <p className="text-[14px] font-medium text-graphite">
                  Example viewing: {slotFormatter.format(new Date(state.result.slotIso))}
                </p>
                <p className="text-[13px] text-fog">No phone call or calendar booking was made.</p>
              </div>
            ) : undefined}
          </FlowStateTransition>
        )}
      </div>

      <div className="flex min-h-64 w-full flex-col gap-2.5 sm:min-h-40 sm:flex-row sm:flex-wrap sm:content-start sm:gap-3">
        {!mirroredAutoCall && canSimulate ? (
          <FlowButton className="w-full sm:w-auto" onClick={() => void startCall()}>
            Simulate viewing call
          </FlowButton>
        ) : undefined}
        {!mirroredAutoCall && state.status === "failed" && state.retryable && state.live ? (
          <FlowButton className="w-full sm:w-auto" onClick={() => void startCall()}>
            Try again
          </FlowButton>
        ) : undefined}
        {!mirroredAutoCall && canOptInLive ? (
          <div className="flex flex-col gap-2">
            <label className="flex min-h-11 items-center gap-2 text-[13px] text-fog">
              <input
                type="checkbox"
                checked={liveOptIn}
                onChange={(event) => setLiveOptIn(event.target.checked)}
              />
              I authorize a real call to the configured team test number.
            </label>
            <FlowButton variant="ghost" disabled={!liveOptIn} onClick={() => void startCall(true)}>
              Request live demo call
            </FlowButton>
          </div>
        ) : undefined}
        <RejectionControl
          listingId={listing.id}
          title={listing.title}
          disabled={status === "dispatching" || busy}
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
