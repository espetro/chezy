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
      "inline-flex items-center rounded-badges border px-2 py-1 text-caption font-normal",
      variantClasses[variant],
      className,
    )}
    {...props}
  />
);
