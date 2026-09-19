"use client";

import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import { useState } from "react";
import { FlowAgentMark } from "@/components/flow/ui/AgentMark";
import { FlowBadge } from "@/components/flow/ui/Badge";
import { FlowButton } from "@/components/flow/ui/Button";
import { AUTO_CALL_MATCH_THRESHOLD } from "@/lib/flow/constants";
import type { FlowListing } from "@/lib/flow/types";

type CallStatus = "idle" | "calling" | "booked" | "failed" | "discarded";

interface BookedVisit {
  slotIso?: string;
  label: string;
  durationMinutes: number;
  live: boolean;
}

interface AgentCallGateProps {
  listing: FlowListing;
}

interface ViewingResponse {
  status?: "mock" | "dispatched" | "failed";
  slotIso?: string;
  detail?: string;
}

const slotFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const autoCallKey = (listingId: string) => `chezy:autocall:${listingId}`;

export const AgentCallGate = ({ listing }: AgentCallGateProps) => {
  const isAutoCall = listing.matchScore >= AUTO_CALL_MATCH_THRESHOLD;
  const [status, setStatus] = useState<CallStatus>("idle");
  const [visit, setVisit] = useState<BookedVisit | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const startCall = async () => {
    setStatus("calling");
    setError(undefined);
    try {
      const response = await fetch("/api/viewing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyRef: listing.id }),
      });
      const data: ViewingResponse = await response.json().catch(() => ({}));
      if (response.ok && data.status !== "failed") {
        setVisit({
          slotIso: data.slotIso,
          label: data.slotIso
            ? slotFormatter.format(new Date(data.slotIso))
            : "the next available slot",
          durationMinutes: 30,
          live: data.status === "dispatched",
        });
        setStatus("booked");
      } else {
        setError(data.detail ?? "The call could not be placed.");
        setStatus("failed");
      }
    } catch {
      setError("Network error while placing the call.");
      setStatus("failed");
    }
  };

  useMountEffect(function autoCallOnMount() {
    // Guard real phone calls: only auto-dial once per listing per browser, even on
    // remounts/reloads. The threshold stays the designer's ≥95% semantic.
    if (isAutoCall && !localStorage.getItem(autoCallKey(listing.id))) {
      localStorage.setItem(autoCallKey(listing.id), new Date().toISOString());
      void startCall();
    }
  });

  if (status === "discarded") {
    return (
      <div className="flex items-center justify-between rounded-cards bg-card-subtle px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <p className="text-[14px] text-fog">Candidate discarded.</p>
        <FlowButton variant="ghost" size="sm" onClick={() => setStatus(visit ? "booked" : "idle")}>
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
              Auto-call · ≥{AUTO_CALL_MATCH_THRESHOLD}% match
            </FlowBadge>
            <p className="text-[13px] text-fog">
              This match cleared Chezy's {AUTO_CALL_MATCH_THRESHOLD}% confidence bar, so
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
        ) : status === "failed" ? (
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-medium text-graphite">
              The call to {listing.agency} failed
            </p>
            <p className="text-[13px] text-fog">{error}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-medium text-graphite">
              Called {listing.agency}
            </p>
            <p className="text-[13px] text-fog">
              Visit booked for {visit?.label} ({visit?.durationMinutes} min).
            </p>
            {visit?.live ? (
              <p className="text-[13px] font-medium text-ember">Live call in progress</p>
            ) : undefined}
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
        {status === "idle" ? (
          <FlowButton className="w-full sm:w-auto" onClick={() => void startCall()}>
            Call the agency now
          </FlowButton>
        ) : undefined}
        {status === "failed" ? (
          <FlowButton className="w-full sm:w-auto" onClick={() => void startCall()}>
            Try again
          </FlowButton>
        ) : undefined}
        <FlowButton
          className="w-full sm:w-auto"
          variant="ghost"
          onClick={() => setStatus("discarded")}
        >
          Discard candidate
        </FlowButton>
      </div>
    </div>
  );
};
