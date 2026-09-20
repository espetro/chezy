import { cn } from "~/lib/utils";

const sizeClasses = { sm: "size-5", lg: "size-14" } as const;

export const BookedCheck = ({
  size = "lg",
  className,
}: {
  size?: keyof typeof sizeClasses;
  className?: string;
}) => (
  <svg
    viewBox="0 0 32 32"
    aria-hidden
    className={cn("animate-check-pop shrink-0", sizeClasses[size], className)}
  >
    <circle cx="16" cy="16" r="16" className="fill-ember" />
    <path
      d="M9.5 16.5l4.5 4.5 8.5-9"
      fill="none"
      strokeWidth={size === "sm" ? 3.5 : 3}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="40"
      strokeDashoffset="0"
      className="animate-check-draw stroke-snow"
    />
  </svg>
);
