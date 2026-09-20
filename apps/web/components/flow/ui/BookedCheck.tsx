"use client";

import { motion } from "motion/react";
import { flowEase } from "~/components/flow/ui/FlowMotion";
import { cn } from "~/lib/utils";

const sizeClasses = { sm: "size-5", lg: "size-14" } as const;

export const BookedCheck = ({
  size = "lg",
  className,
  animate = true,
}: {
  size?: keyof typeof sizeClasses;
  className?: string;
  animate?: boolean;
}) => (
  <motion.span className={cn("relative inline-flex shrink-0", sizeClasses[size], className)}>
    {size === "lg" ? (
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full bg-ember"
        initial={animate ? { scale: 0.6, opacity: 0.5 } : { scale: 1.9, opacity: 0 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 0.9, ease: flowEase, delay: 0.15 }}
      />
    ) : undefined}
    <motion.svg
      viewBox="0 0 32 32"
      aria-hidden
      initial={animate ? { scale: 0.5, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
    >
      <circle cx="16" cy="16" r="16" className="fill-ember" />
      <motion.path
        d="M9.5 16.5l4.5 4.5 8.5-9"
        fill="none"
        strokeWidth={size === "sm" ? 3.5 : 3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-snow"
        initial={animate ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 0.45, ease: flowEase, delay: 0.2 },
          opacity: { duration: 0.1, delay: 0.2 },
        }}
      />
    </motion.svg>
  </motion.span>
);
