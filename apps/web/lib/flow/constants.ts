// /flow-scoped constants. Not `apps/web/lib/constants.ts` — that file is the real app's
// hardcoded-values registry; this one only backs the onboarding prototype under /flow.

// Simulated agent "thinking" pause before each onboarding message. Randomized within the
// range so replies feel typed by someone, not fired by a timer; short enough not to drag.
export const AGENT_THINKING_DELAY_MS = { min: 700, max: 1300 } as const;

// Canonical home is ~/lib/constants (chat tools read it); re-exported so the
// frozen (flow) surface keeps compiling.
export { AUTO_CALL_MATCH_THRESHOLD } from "~/lib/constants";
