"use client";

import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import { useRef, useState } from "react";
import { FlowAgentMark } from "@/components/flow/ui/AgentMark";
import { FlowBadge } from "@/components/flow/ui/Badge";
import { FlowButton } from "@/components/flow/ui/Button";
import { type BookedVisit, nextVisitSlot } from "@/lib/flow/calling";
import { AUTO_CALL_MATCH_THRESHOLD, CALL_DIALING_DELAY_MS } from "@/lib/flow/constants";
import type { Listing } from "@/lib/flow/types";

type CallStatus = "idle" | "calling" | "booked" | "discarded";

interface AgentCallGateProps {
  listing: Listing;
}

const randomDialingDelay = () =>
  CALL_DIALING_DELAY_MS.min +
  Math.random() * (CALL_DIALING_DELAY_MS.max - CALL_DIALING_DELAY_MS.min);

export const AgentCallGate = ({ listing }: AgentCallGateProps) => {
  const isAutoCall = listing.matchScore >= AUTO_CALL_MATCH_THRESHOLD;
  const [status, setStatus] = useState<CallStatus>(isAutoCall ? "calling" : "idle");
  const [visit, setVisit] = useState<BookedVisit | undefined>(undefined);
  const dialingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const startCall = () => {
    setStatus("calling");
    clearTimeout(dialingTimer.current);
    dialingTimer.current = setTimeout(function resolveCall() {
      setVisit(nextVisitSlot());
      setStatus("booked");
    }, randomDialingDelay());
  };

  useMountEffect(function autoCallOnMount() {
    if (isAutoCall) startCall();
    return function clearPendingCall() {
      clearTimeout(dialingTimer.current);
    };
  });

  if (status === "discarded") {
    return (
      <div className="flex items-center justify-between rounded-cards bg-card-subtle px-6 py-5 shadow-sm">
        <p className="text-[14px] text-fog">Candidate discarded.</p>
        <FlowButton variant="ghost" size="sm" onClick={() => setStatus(isAutoCall ? "booked" : "idle")}>
          Undo
        </FlowButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-cards bg-snow p-7 shadow-sm">
      {isAutoCall ? (
        <div className="flex items-start gap-3">
          <FlowAgentMark size="sm" className="mt-0.5" />
          <div className="flex flex-col gap-1">
            <FlowBadge variant="accent" className="w-fit">
              Auto-call · ≥{AUTO_CALL_MATCH_THRESHOLD}% match
            </FlowBadge>
            <p className="text-[13px] text-fog">
              This match cleared chezMoi's {AUTO_CALL_MATCH_THRESHOLD}% confidence bar, so
              the agent called {listing.agency} automatically — no approval needed.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <FlowAgentMark size="sm" className="mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-medium text-obsidian">
              {listing.matchScore}% match
            </p>
            <p className="text-[13px] text-fog">
              This is below my {AUTO_CALL_MATCH_THRESHOLD}% bar for calling on my own. I'll
              keep watching it, or you can ask me to call now.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-[20px] bg-paper p-5">
        {status === "idle" ? (
          <p className="text-[14px] text-iron">Not called yet.</p>
        ) : status === "calling" ? (
          <div className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-ember motion-reduce:animate-none" />
            <p className="text-[14px] font-medium text-graphite">
              Calling {listing.agency}…
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-medium text-graphite">
              Called {listing.agency}
            </p>
            <p className="text-[13px] text-fog">
              Visit booked for {visit?.label} ({visit?.durationMinutes} min).
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {status === "idle" ? <FlowButton onClick={startCall}>Call the agency now</FlowButton> : undefined}
        <FlowButton variant="ghost" onClick={() => setStatus("discarded")}>
          Discard candidate
        </FlowButton>
      </div>
    </div>
  );
};
