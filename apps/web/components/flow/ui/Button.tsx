import { cn } from "~/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "sm";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-obsidian text-snow border border-[#2c2e34] shadow-[var(--shadow-btn-primary)] hover:opacity-90",
  secondary: "bg-snow text-graphite border border-mist hover:bg-card-subtle",
  ghost: "bg-transparent text-iron hover:bg-card-subtle",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "px-4 py-3 text-[14px]",
  sm: "px-3 py-2 text-[13px]",
};

export const FlowButton = ({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) => (
  <button
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-buttons font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:ring-offset-2",
      variantClasses[variant],
      sizeClasses[size],
      className,
    )}
    {...props}
  />
);
