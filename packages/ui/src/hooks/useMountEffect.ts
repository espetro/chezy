import { useEffect } from "react";

/**
 * Run an effect exactly once on mount. Use this instead of `useEffect(fn, [])`
 * to make the "setup on mount, cleanup on unmount" intent explicit.
 *
 * Only for synchronizing with external systems (DOM integration, third-party
 * widget lifecycles, browser API subscriptions). Do NOT use for deriving state,
 * fetching data, or responding to user actions — see
 * `.agents/skills/no-use-effect/SKILL.md` for the five replacement patterns.
 *
 * Mirrors `@brioso/ui/hooks/useMountEffect` and is the only sanctioned escape
 * hatch from chezy's useEffect ban (enforced by `.oxlintrc.json`).
 */
export function useMountEffect(effect: () => void | (() => void)): void {
  useEffect(effect, []);
}
