"use client";

import { AnimatePresence, motion } from "motion/react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { CALL_STAGES } from "~/lib/flow/use-viewing-booking";

const slotFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Madrid",
});

// One line per stage; index matches the `stage` from useViewingBooking.
export const callTranscript = (agency: string, slotIso?: string): string[] => [
  `Calling ${agency}`,
  "Asking about the listing",
  slotIso ? `Proposing ${slotFormatter.format(new Date(slotIso))}` : "Proposing a date and time",
  "Confirming the visit",
];

const CALL_STAGE_LABELS = [
  "AI calling…",
  "Asking about the listing…",
  "Proposing a slot…",
  "Confirming the visit…",
] as const;

export const callStageLabel = (stage: number): string =>
  CALL_STAGE_LABELS[Math.min(Math.max(stage, 0), CALL_STAGES - 1)];

export const CallRings = ({ className }: { className?: string }) => (
  <span aria-hidden className={className}>
    <span className="absolute inset-0 animate-call-ring rounded-full border-2 border-ember opacity-0" />
    <span
      className="absolute inset-0 animate-call-ring rounded-full border-2 border-ember opacity-0"
      style={{ animationDelay: "0.9s" }}
    />
  </span>
);

export const CallProgress = ({
  agency,
  stage,
  slotIso,
  transcript,
}: {
  agency: string;
  stage: number;
  slotIso?: string;
  transcript?: { role: "agent" | "human"; text: string }[];
}) => {
  const lines = transcript?.length
    ? transcript.map(({ role, text }) => `${role === "agent" ? "Chezy" : "Agency"}: ${text}`)
    : callTranscript(agency, slotIso).slice(0, Math.min(stage, CALL_STAGES - 1) + 1);
  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <div className="relative flex size-14 items-center justify-center">
        <CallRings className="absolute inset-0" />
        <FlowAgentMark size="lg" className="relative" />
      </div>
      <div className="w-full">
        <p className="text-[15px] font-medium text-obsidian">AI calling</p>
        <ol className="mt-3 flex flex-col gap-1.5" aria-live="polite">
          <AnimatePresence initial={false}>
            {lines.map((line, index) => (
              <motion.li
                key={`${index}-${line}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: index === lines.length - 1 ? 1 : 0.55, y: 0 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
                className="text-[13px] text-graphite"
              >
                {line}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </div>
    </div>
  );
};
