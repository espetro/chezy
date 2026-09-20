// /flow-scoped constants. Not `apps/web/lib/constants.ts` — that file is the real app's
// hardcoded-values registry; this one only backs the onboarding prototype under /flow.

// Simulated agent "thinking" pause before each onboarding message. Randomized within the
// range so replies feel typed by someone, not fired by a timer; short enough not to drag.
export const AGENT_THINKING_DELAY_MS = { min: 700, max: 1300 } as const;

// Match score at/above which the agent calls the agency on its own — no approval gate,
// regardless of the autonomy tier chosen in onboarding. See AgentCallGate.tsx.
export const AUTO_CALL_MATCH_THRESHOLD = 95;

// Client poll cadence for /api/adaptation/[jobId] while a job is non-terminal.
// Lives here, not lib/constants.ts: that module imports lib/db/utils (bcrypt,
// ai) which must not ship in the client bundle of AdaptationStatus.tsx.
export const ADAPTATION_POLL_INTERVAL_MS = 4000;
