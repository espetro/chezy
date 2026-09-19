import type { Category } from "./logger.ts";

/**
 * Root-level LogTape logger used for the application boundary (process
 * startup, shutdown, configuration errors). Internal subsystems should
 * scope their category to a child of `rootLogger`'s namespace, e.g.
 * `["chezy", "db"]` rather than reaching for `getLogger()` directly.
 */
export const rootLogger = {
  category: ["chezy"] as const satisfies readonly Category[],
} as const;

export type { Category };
