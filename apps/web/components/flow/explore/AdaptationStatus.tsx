"use client";

import { AdaptationOutputSchema, type AdaptationJob } from "@chezy/contract";
import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import * as v from "valibot";
import { AdaptationTrace } from "~/components/flow/explore/AdaptationTrace";
import { ADAPTATION_POLL_INTERVAL_MS } from "~/lib/flow/constants";

const TERMINAL = new Set(["ready", "failed", "stale"]);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
  correcting: "The validator refused Devin's first comparison. Asking it to correct.",
  validating: "Checking the result against your listings.",
  ready: "Comparison ready.",
  failed: "Couldn't build a comparison. Your feed is unchanged.",
  stale: "Your preferences changed, so this comparison was discarded.",
};

export const AdaptationStatus = ({ job }: { job: AdaptationJob }) => {
  const [retryError, setRetryError] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const { data: latest = job, mutate } = useSWR(
    [`${basePath}/api/adaptation/${job.jobId}`] as const,
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
  if (latest.status === "ready") return <RefreshOnce key={`${latest.jobId}-${latest.run}`} />;

  // A deliberate new attempt: never triggered by a reload or a poll.
  const retry = async () => {
    setRetrying(true);
    setRetryError(undefined);
    try {
      const response = await fetch(`${basePath}/api/adaptation/${job.jobId}/retry`, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("retry refused");
      const next = v.parse(AdaptationOutputSchema, await response.json()).job;
      await mutate(next, { revalidate: false });
    } catch {
      setRetryError("Couldn't start a new attempt. Your feed is unchanged.");
    } finally {
      setRetrying(false);
    }
  };

  const simulated = job.provider === "mock" && !TERMINAL.has(latest.status);
  const rejectedCount = latest.trace.filter((event) => event.step === "rejected").length;

  return (
    <section aria-label="Comparison status" className="flex flex-col gap-2">
      <p role="status" aria-live="polite" className="text-sm text-fog">
        {simulated ? "Simulated: " : ""}
        {latest.status === "failed" ? (latest.error ?? copy.failed) : copy[latest.status]}
        {latest.status === "correcting" && rejectedCount > 0 ? <> Attempt 2 of 2.</> : undefined}
        {(latest.status === "running" || latest.status === "correcting") && latest.sessionUrl ? (
          <>
            {" "}
            <a href={latest.sessionUrl} target="_blank" rel="noreferrer" className="underline">
              View session
            </a>
          </>
        ) : undefined}
      </p>
      {latest.status === "failed" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="inline-flex min-h-11 items-center rounded-full border border-mist px-4 text-sm font-medium text-obsidian disabled:opacity-60"
          >
            {retrying ? "Starting a new attempt…" : "Try again"}
          </button>
          {retryError ? (
            <p role="alert" className="text-sm text-fog">
              {retryError}
            </p>
          ) : undefined}
        </div>
      ) : undefined}
      {latest.trace.length > 1 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-fog">Run trace</summary>
          <div className="mt-2">
            <AdaptationTrace trace={latest.trace} />
          </div>
        </details>
      ) : undefined}
    </section>
  );
};
