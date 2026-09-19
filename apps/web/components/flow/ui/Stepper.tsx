interface StepperProps {
  step: number;
  total: number;
  label: string;
}

export const FlowStepper = ({ step, total, label }: StepperProps) => {
  const percent = Math.round((Math.min(step, total) / total) * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-steel">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-ember" />
          <span className="text-label-sm uppercase tracking-wider text-obsidian">
            {step === 0 ? "Getting started" : `Step ${Math.min(step, total)} of ${total}`}
          </span>
        </div>
        <span className="text-label-sm font-medium text-fog">{label}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(step, total)}
        className="h-1 w-full overflow-hidden rounded-full bg-cloud"
      >
        <div
          className="h-full rounded-full bg-obsidian transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
