"use client";

import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

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
}) => {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reducedMotion !== false ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const FlowStateTransition = ({
  children,
  state,
}: {
  children: ReactNode;
  state: string;
}) => {
  const reducedMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, y: reducedMotion !== false ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.16 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
