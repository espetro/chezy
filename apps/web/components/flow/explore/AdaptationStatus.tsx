"use client";

import { AdaptationOutputSchema, type AdaptationJob } from "@chezy/contract";
import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import * as v from "valibot";
import { ADAPTATION_POLL_INTERVAL_MS } from "~/lib/flow/constants";

const TERMINAL = new Set(["ready", "failed", "stale"]);

async function fetchJob([url]: readonly [string]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Adaptation status unavailable");
  return v.parse(AdaptationOutputSchema, await response.json()).job;
}

// Mounts exactly once per ready transition (keyed by jobId) and refreshes the
// server components so the resolved panel replaces this status line.
const RefreshOnce = () => {
  const router = useRouter();
  useMountEffect(function refreshFeedForPanel() {
    router.refresh();
  });
  return undefined;
};

const copy: Record<AdaptationJob["status"], string> = {
  queued: "Queued for Devin.",
  running: "Devin is building your comparison.",
  correcting: "The validator rejected Devin's first comparison. Asking it to correct.",
  validating: "Checking the result against your listings.",
  ready: "Comparison ready.",
  failed: "Couldn't build a comparison. Your feed is unchanged.",
  stale: "Your preferences changed, so this comparison was discarded.",
};

export const AdaptationStatus = ({ job }: { job: AdaptationJob }) => {
  const { data: latest = job } = useSWR(
    [`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/adaptation/${job.jobId}`] as const,
    fetchJob,
    {
      fallbackData: job,
      refreshInterval: (latest) =>
        latest && TERMINAL.has(latest.status) ? 0 : ADAPTATION_POLL_INTERVAL_MS,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: true,
    },
  );

  // The accepted panel takes over once ready; only the one-shot refresh mounts.
  if (latest.status === "ready") return <RefreshOnce key={latest.jobId} />;

  const prefix = job.provider === "mock" && !TERMINAL.has(latest.status) ? "Simulated: " : "";

  return (
    <p role="status" aria-live="polite" className="text-sm text-fog">
      {prefix}
      {latest.status === "failed" ? (latest.error ?? copy.failed) : copy[latest.status]}
      {latest.status === "running" && latest.sessionUrl ? (
        <>
          {" "}
          <a href={latest.sessionUrl} target="_blank" rel="noreferrer" className="underline">
            View session
          </a>
        </>
      ) : undefined}
    </p>
  );
};
