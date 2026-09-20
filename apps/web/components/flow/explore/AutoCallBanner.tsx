"use client";

import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { useLatestCallActivity } from "~/lib/flow/agent-activity";
import { claimAutoCall, placeAgentCall } from "~/lib/flow/agent-call";
import type { FlowListing } from "~/lib/flow/types";

interface AutoCallBannerProps {
  listing: FlowListing;
}

const dotDelays = ["0ms", "160ms", "320ms"];

// Sits under the carousel and reflects whichever listing cleared the auto-call threshold —
// triggers the call itself the first time it mounts (claimAutoCall guards against a double
// dial if the user already opened /explore/[id] for the same listing). Reads from the same
// agent-activity log as AgentCallGate and AgentActivityToast, so all three surfaces agree.
export const AutoCallBanner = ({ listing }: AutoCallBannerProps) => {
  const latest = useLatestCallActivity(listing.id);

  useMountEffect(function autoCallOnMount() {
    if (claimAutoCall(listing.id)) void placeAgentCall(listing);
  });

  if (!latest) return undefined;

  return (
    <div className="flex animate-fade-up items-center gap-3 rounded-cards bg-snow px-4 py-3 shadow-sm sm:px-6">
      <FlowAgentMark size="sm" />
      <p className="flex-1 text-[13px] text-graphite sm:text-[14px]">
        {latest.kind === "calling"
          ? `Calling ${latest.agency} about ${latest.listingTitle}…`
          : latest.kind === "simulated"
            ? `Called ${latest.agency} — visit booked for ${latest.visit?.label} (${latest.visit?.durationMinutes} min).`
            : latest.kind === "dispatched"
              ? `Called ${latest.agency} — awaiting their confirmation.`
              : `The call to ${latest.agency} failed — ${latest.error}`}
      </p>
      {latest.kind === "calling" ? (
        <span className="flex items-center gap-1">
          {dotDelays.map((delay) => (
            <span
              key={delay}
              className="size-1.5 animate-dot-pulse rounded-full bg-ember"
              style={{ animationDelay: delay }}
            />
          ))}
        </span>
      ) : undefined}
    </div>
  );
};
