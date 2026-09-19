import { cn } from "~/lib/utils";

type BadgeVariant = "accent" | "deep" | "muted" | "steel";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  accent: "bg-ember/10 text-ember font-semibold",
  deep: "text-ember-deep font-medium",
  muted: "text-fog",
  steel: "text-steel",
};

export const FlowBadge = ({ variant = "muted", className, ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-label-sm",
      variantClasses[variant],
      className,
    )}
    {...props}
  />
);
