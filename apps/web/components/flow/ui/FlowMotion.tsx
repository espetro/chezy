"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Constant initial/animate values: reducedMotion="user" on MotionConfig already
// neutralises transform animations for users who prefer reduced motion, and
// deriving them from useReducedMotion() would render different markup on the
// server (null) than the client (boolean), breaking hydration.
export const FlowMotion = ({ children }: { children: ReactNode }) => (
  <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: "easeOut" }}>
    {children}
  </MotionConfig>
);

export const FlowReveal = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2 }}
    className={className}
  >
    {children}
  </motion.div>
);

export const FlowStateTransition = ({
  children,
  state,
}: {
  children: ReactNode;
  state: string;
}) => (
  <AnimatePresence initial={false} mode="wait">
    <motion.div
      key={state}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);
