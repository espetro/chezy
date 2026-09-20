import type { AdaptationJob } from "@chezy/contract";
import Link from "next/link";
import { UNKNOWN_LISTING_TITLE, type ResolvedPanel } from "~/lib/adaptation/resolve";
import { AdaptationTrace } from "~/components/flow/explore/AdaptationTrace";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";

// How the accepted candidate got through the validator gate.
const provenance = (job: AdaptationJob) => {
  const corrections = job.trace.filter((event) => event.step === "rejected").length;
  const outcome =
    corrections > 0
      ? `Accepted on attempt ${job.attempt} after the validator refused the first candidate.`
      : "Accepted on the first attempt.";
  return job.run > 1 ? `${outcome} This was a new attempt after an earlier failure.` : outcome;
};

interface ComparisonPanelProps {
  panel: ResolvedPanel;
  job: AdaptationJob;
}

export const ComparisonPanel = ({ panel, job }: ComparisonPanelProps) => (
  <section aria-label="Adaptive comparison" className="rounded-cards bg-snow p-4 shadow-sm sm:p-6">
    <div className="flex items-start gap-3">
      <FlowAgentMark size="sm" className="mt-0.5" />
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[15px] font-medium text-obsidian">{panel.title}</h2>
        <p className="text-[13px] text-fog">
          {job.provider === "devin" && job.sessionUrl ? (
            <>
              Built by a Devin session from your rejection.{" "}
              <a href={job.sessionUrl} target="_blank" rel="noreferrer" className="underline">
                View session
              </a>
            </>
          ) : (
            "Simulated panel. No Devin session was created."
          )}{" "}
          {provenance(job)}
        </p>
        {job.trace.length > 1 ? (
          <details className="text-[13px]">
            <summary className="cursor-pointer text-fog">Run trace</summary>
            <div className="mt-2">
              <AdaptationTrace trace={job.trace} />
            </div>
          </details>
        ) : undefined}
      </div>
    </div>

    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Comparison of candidate listings</caption>
        <thead>
          <tr className="border-b border-mist text-left">
            <th scope="col" className="py-2 pr-3 font-medium text-fog">
              Compared on
            </th>
            {panel.columns.map((column) => (
              <th key={column.listingId} scope="col" className="py-2 pr-3 font-medium">
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {panel.rows.map((row) => (
            <tr key={row.field} className="border-b border-mist last:border-0">
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {row.label}
                {row.note ? <small className="block text-fog">{row.note}</small> : undefined}
              </th>
              {row.cells.map((cell, index) => (
                <td key={panel.columns[index]?.listingId ?? index} className="py-2 pr-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {panel.actions.includes("open_listing")
        ? panel.columns
            .filter((column) => column.title !== UNKNOWN_LISTING_TITLE)
            .map((column) => (
              <Link
                key={column.listingId}
                href={`/explore/${encodeURIComponent(column.listingId)}`}
                className="inline-flex min-h-11 items-center underline"
              >
                Open {column.title}
              </Link>
            ))
        : undefined}
      {panel.actions.includes("edit_preferences") ? (
        <Link href="/onboarding" className="inline-flex min-h-11 items-center underline">
          Edit preferences
        </Link>
      ) : undefined}
    </div>
  </section>
);
