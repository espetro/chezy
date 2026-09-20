import { cn } from "~/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "sm";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-obsidian text-snow transition-transform active:scale-[0.99] hover:opacity-90",
  secondary: "bg-snow text-graphite border border-mist hover:bg-card-subtle",
  ghost: "bg-transparent text-iron hover:bg-card-subtle",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-[14px]",
  sm: "h-9 px-3 text-xs sm:text-[13px]",
};

// Shared so a Link can be styled as a button without nesting a <button> inside an <a>
// (interactive content inside an anchor is invalid HTML and breaks keyboard semantics).
export const flowButtonClass = ({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) =>
  cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-buttons font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:ring-offset-2",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

export const FlowButton = ({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) => <button className={flowButtonClass({ variant, size, className })} {...props} />;
