import type { TraceEvent } from "@chezy/contract";

const label = (event: TraceEvent): string => {
  switch (event.step) {
    case "triggered":
      return "Rejection recorded, comparison requested";
    case "session_created":
      return "Devin session started";
    case "proposed":
      return `Candidate ${event.attempt ?? "?"} proposed`;
    case "rejected":
      return `Validator refused candidate ${event.attempt ?? "?"}: ${(event.errors ?? [])
        .map((error) => error.code)
        .join(", ")}`;
    case "correcting":
      return "Errors sent back to the same session for one correction";
    case "accepted":
      return `Candidate ${event.attempt ?? "?"} accepted`;
    case "failed":
      return `Failed: ${event.message ?? "no result"}`;
    case "stale":
      return "Discarded: your preferences changed";
    case "retried":
      return `New attempt started (run ${event.run ?? "?"})`;
  }
};

// Seconds since the first event; deterministic on server and client, unlike
// locale time strings.
const offset = (event: TraceEvent, first: TraceEvent | undefined) =>
  first ? `+${Math.max(0, Math.round((Date.parse(event.at) - Date.parse(first.at)) / 1000))}s` : "";

export const AdaptationTrace = ({ trace }: { trace: readonly TraceEvent[] }) => (
  <ol aria-label="Run trace" className="flex flex-col gap-1 text-[13px] text-fog">
    {trace.map((event, index) => (
      <li key={`${event.at}-${event.step}-${index}`} className="flex gap-2">
        <span className="w-12 shrink-0 tabular-nums">{offset(event, trace[0])}</span>
        <span data-step={event.step}>{label(event)}</span>
      </li>
    ))}
  </ol>
);
