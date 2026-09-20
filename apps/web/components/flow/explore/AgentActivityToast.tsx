"use client";

import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { type AgentActivityEntry, useAgentActivity } from "~/lib/flow/agent-activity";

const AUTO_DISMISS_MS = 6000;

interface ToastBodyProps {
  entry: AgentActivityEntry;
}

// Keyed by entry.id from the parent, so a fresh activity entry always mounts a fresh
// instance — the sanctioned "key prop" pattern for per-item timers instead of useEffect.
const ToastBody = ({ entry }: ToastBodyProps) => {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  useMountEffect(function autoDismiss() {
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  });

  if (dismissed) return undefined;

  const text =
    entry.kind === "calling"
      ? `Calling ${entry.agency} about ${entry.listingTitle}…`
      : entry.kind === "simulated"
        ? `Called ${entry.agency} — visit booked for ${entry.visit?.label} (${entry.visit?.durationMinutes} min).`
        : entry.kind === "dispatched"
          ? `Called ${entry.agency} about ${entry.listingTitle} — awaiting their confirmation.`
          : `The call to ${entry.agency} failed — ${entry.error}`;

  return (
    <button
      type="button"
      onClick={() => {
        setDismissed(true);
        router.push(`/explore/${encodeURIComponent(entry.listingId)}`);
      }}
      className="fixed inset-x-4 bottom-4 z-30 flex animate-fade-up items-center gap-3 rounded-cards bg-obsidian px-4 py-3 text-left shadow-lg sm:inset-x-auto sm:right-6 sm:left-auto sm:w-[380px]"
    >
      <FlowAgentMark size="sm" />
      <span className="flex-1 text-[13px] text-snow">{text}</span>
      <span className="shrink-0 text-[12px] text-mist">View →</span>
    </button>
  );
};

// Mounted once at the (flow) layout level. Shows the latest agent-call activity as a
// floating notification on any screen that isn't the one already displaying it in full —
// the /explore carousel gets its own inline AutoCallBanner, and a listing's own detail page
// already shows AgentCallGate — so this only fires on other pages (onboarding, a
// *different* listing's detail). Tapping it jumps straight to that listing.
export const AgentActivityToast = () => {
  const pathname = usePathname();
  const activity = useAgentActivity();
  const latest = activity.at(-1);

  const onExplore = pathname === "/explore";
  const detailMatch = pathname.match(/^\/explore\/(.+)$/);
  const currentListingId = detailMatch ? decodeURIComponent(detailMatch[1]) : undefined;
  const onOwnDetail = currentListingId !== undefined && latest?.listingId === currentListingId;

  if (!latest || onExplore || onOwnDetail) return undefined;

  return <ToastBody key={latest.id} entry={latest} />;
};
