"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export const flowSpring = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 } as const;
export const flowEase = [0.22, 1, 0.36, 1] as const;

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
  className,
}: {
  children: ReactNode;
  state: string;
  className?: string;
}) => (
  <AnimatePresence initial={false} mode="popLayout">
    <motion.div
      key={state}
      initial={{ opacity: 0, y: 10, scale: 0.98, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{
        opacity: 0,
        y: -8,
        scale: 0.98,
        filter: "blur(4px)",
        transition: { duration: 0.18, ease: flowEase },
      }}
      transition={flowSpring}
      className={className}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);
