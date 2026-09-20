"use client";

import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import { useRef, useState } from "react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { FlowBadge } from "~/components/flow/ui/Badge";
import { FlowButton } from "~/components/flow/ui/Button";
import { AUTO_CALL_MATCH_THRESHOLD } from "~/lib/flow/constants";
import type { FlowListing } from "~/lib/flow/types";
import { createViewingController, type ViewingState } from "~/lib/viewing";

interface AgentCallGateProps {
  listing: FlowListing;
}

const slotFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const autoCallKey = (listingId: string) => `chezy:autocall:${listingId}`;

const CallGate = ({ listing }: AgentCallGateProps) => {
  const isAutoCall = listing.matchScore >= AUTO_CALL_MATCH_THRESHOLD;
  const [state, setState] = useState<ViewingState>({ status: "idle" });
  const [discarded, setDiscarded] = useState(false);
  const [liveOptIn, setLiveOptIn] = useState(false);
  const controller = useRef<ReturnType<typeof createViewingController> | undefined>(undefined);
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

  const startCall = async (live = false) => {
    if (live) setLiveOptIn(false);
    const pending = getController().start(live);
    setState({ status: "dispatching" });
    setState(await pending);
  };

  useMountEffect(function autoCallOnMount() {
    const restored = getController().restore();
    setState(restored);
    if (restored.status !== "idle" || !isAutoCall) return;
    try {
      if (localStorage.getItem(autoCallKey(listing.id))) return;
      localStorage.setItem(autoCallKey(listing.id), new Date().toISOString());
    } catch {
      // Automatic requests only simulate; blocked storage cannot cause a live call.
    }
    void startCall();
  });

  if (discarded) {
    return (
      <div className="flex items-center justify-between rounded-cards bg-card-subtle px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <p className="text-[14px] text-fog">Candidate discarded.</p>
        <FlowButton variant="ghost" size="sm" onClick={() => setDiscarded(false)}>
          Undo
        </FlowButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-cards bg-snow p-5 shadow-sm sm:p-7">
      {isAutoCall ? (
        <div className="flex items-start gap-3">
          <FlowAgentMark size="sm" className="mt-0.5" />
          <div className="flex flex-col gap-1">
            <FlowBadge variant="accent" className="w-fit">
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

      <div className="rounded-[20px] bg-paper p-5" role="status" aria-live="polite">
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
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
        {canSimulate ? (
          <FlowButton className="w-full sm:w-auto" onClick={() => void startCall()}>
            Simulate viewing call
          </FlowButton>
        ) : undefined}
        {state.status === "failed" && state.retryable && state.live ? (
          <FlowButton className="w-full sm:w-auto" onClick={() => void startCall()}>
            Try again
          </FlowButton>
        ) : undefined}
        {canOptInLive ? (
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 text-[13px] text-fog">
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
        <FlowButton
          className="w-full sm:w-auto"
          variant="ghost"
          disabled={status === "dispatching"}
          onClick={() => setDiscarded(true)}
        >
          Discard candidate
        </FlowButton>
      </div>
    </div>
  );
};

export const AgentCallGate = ({ listing }: AgentCallGateProps) => (
  <CallGate key={listing.id} listing={listing} />
);
