import { cn } from "~/lib/utils";

type PillVariant = "subtle" | "filled" | "accent";

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
}

const variantClasses: Record<PillVariant, string> = {
  subtle: "bg-paper text-iron border-transparent",
  filled: "bg-iron text-[#fafafa] border-transparent",
  accent: "bg-ember-soft text-ember-deep border-transparent",
};

export const FlowPill = ({ variant = "subtle", className, ...props }: PillProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-normal",
      variantClasses[variant],
      className,
    )}
    {...props}
  />
);
