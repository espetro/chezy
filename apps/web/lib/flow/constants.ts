// /flow-scoped constants. Not `apps/web/lib/constants.ts` — that file is the real app's
// hardcoded-values registry; this one only backs the onboarding prototype under /flow.

// Simulated agent "thinking" pause before each onboarding message. Randomized within the
// range so replies feel typed by someone, not fired by a timer; short enough not to drag.
export const AGENT_THINKING_DELAY_MS = { min: 700, max: 1300 } as const;

// Minimum time the calling state stays on screen. The mock provider answers in under
// 100 ms; the three scripted steps (0 / 900 / 1800 ms) need this long to be readable.
export const CALL_SEQUENCE_MS = 2600;

// Canonical home is ~/lib/constants (chat tools read it); re-exported so the
// frozen (flow) surface keeps compiling.
export { AUTO_CALL_MATCH_THRESHOLD } from "~/lib/constants";
