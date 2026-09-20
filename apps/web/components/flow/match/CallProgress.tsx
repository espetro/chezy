import { FlowAgentMark } from "~/components/flow/ui/AgentMark";

const STEPS = [
  "Dialing the agency",
  "Introducing itself as Chezy's AI assistant",
  "Asking for a viewing slot",
] as const;

const STEP_DELAY_MS = 900;

export const CallRings = ({ className }: { className?: string }) => (
  <span aria-hidden className={className}>
    <span className="absolute inset-0 animate-call-ring rounded-full border-2 border-ember opacity-0" />
    <span
      className="absolute inset-0 animate-call-ring rounded-full border-2 border-ember opacity-0"
      style={{ animationDelay: "0.9s" }}
    />
  </span>
);

export const CallProgress = () => (
  <div className="flex flex-col items-center gap-5 py-2 text-center">
    <div className="relative flex size-14 items-center justify-center">
      <CallRings className="absolute inset-0" />
      <FlowAgentMark size="lg" className="relative" />
    </div>
    <div>
      <p className="text-[15px] font-medium text-obsidian">Calling the agency</p>
      <ol className="mt-3 flex flex-col gap-1.5">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className="animate-fade-up text-[13px] text-fog"
            style={{ animationDelay: `${index * STEP_DELAY_MS}ms` }}
          >
            {step}
          </li>
        ))}
      </ol>
    </div>
  </div>
);
