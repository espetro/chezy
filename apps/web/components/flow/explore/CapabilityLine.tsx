"use client";

import { CapabilityOutputSchema, type CapabilityJob } from "@chezy/contract";
import useSWR from "swr";
import * as v from "valibot";
import { ADAPTATION_POLL_INTERVAL_MS } from "~/lib/flow/constants";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const fetchCapability = async ([url]: readonly [string]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Capability status unavailable");
  return v.parse(CapabilityOutputSchema, await response.json()).capability;
};

const missingPct = (coverage: number) => Math.round((1 - coverage) * 100);

export const CapabilityLine = ({ capability }: { capability: CapabilityJob }) => {
  const { data: latest = capability } = useSWR(
    [`${basePath}/api/capability/${capability.jobId}`] as const,
    fetchCapability,
    {
      fallbackData: capability,
      refreshInterval: (job) =>
        job && (job.status === "queued" || job.status === "running") && job.provider === "devin"
          ? ADAPTATION_POLL_INTERVAL_MS
          : 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: true,
    },
  );
  const gapCopy = `This gap is real for most listings (${missingPct(latest.coverage)}% have no outdoor-space data).`;
  if (latest.provider === "mock") {
    return (
      <p role="status" className="text-[13px] text-fog" data-capability={latest.capability}>
        Simulated: capability gap recorded ({missingPct(latest.coverage)}% have no outdoor-space
        data); no Devin session was created.
      </p>
    );
  }
  if (latest.status === "failed") {
    return (
      <p role="status" className="text-[13px] text-fog" data-capability={latest.capability}>
        This gap is real for most listings, but Devin couldn't start building the capability.
        {latest.error ? ` ${latest.error}` : ""}
      </p>
    );
  }
  return (
    <p role="status" className="text-[13px] text-fog" data-capability={latest.capability}>
      {gapCopy}{" "}
      {latest.status === "pr_opened" ? (
        <>
          Devin opened a PR:{" "}
          {latest.prUrl ? (
            <a href={latest.prUrl} target="_blank" rel="noreferrer" className="underline">
              PR opened
            </a>
          ) : undefined}{" "}
        </>
      ) : undefined}
      {latest.sessionUrl ? (
        <a href={latest.sessionUrl} target="_blank" rel="noreferrer" className="underline">
          View session
        </a>
      ) : undefined}
    </p>
  );
};
