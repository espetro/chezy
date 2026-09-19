import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: { wrap: "size-6", icon: 13, dot: "-right-0.5 -top-0.5 size-2.5", inner: undefined },
  md: { wrap: "size-9", icon: 18, dot: "-right-0.5 -top-0.5 size-2.5", inner: undefined },
  lg: { wrap: "size-10", icon: 20, dot: "-bottom-0.5 -right-0.5 size-3", inner: "size-1.5" },
} as const;

export const FlowAgentMark = ({ size = "md", className }: AgentMarkProps) => {
  const spec = sizeClasses[size];

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-obsidian text-snow",
        spec.wrap,
        className,
      )}
    >
      <Bot size={spec.icon} aria-hidden />
      <span
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-ember ring-2 ring-paper",
          spec.dot,
        )}
      >
        {spec.inner ? <span className={cn("rounded-full bg-snow", spec.inner)} /> : undefined}
      </span>
    </div>
  );
};
