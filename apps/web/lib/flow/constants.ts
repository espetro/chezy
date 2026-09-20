// /flow-scoped constants. Not `apps/web/lib/constants.ts` — that file is the real app's
// hardcoded-values registry; this one only backs the onboarding prototype under /flow.

// Simulated agent "thinking" pause before each onboarding message. Randomized within the
// range so replies feel typed by someone, not fired by a timer; short enough not to drag.
export const AGENT_THINKING_DELAY_MS = { min: 700, max: 1300 } as const;

// Mock calls answer in under 100 ms, so the transcript advances one stage every
// MOCK_STAGE_MS to stay readable. Live calls advance the middle stages on the
// LIVE_STAGE_AT_MS timeline (typical agency call: greeting by ~12 s, slot talk by
// ~35 s) until the provider streams real events; dispatch and the booking webhook
// are the two real signals today.
export const MOCK_STAGE_MS = 800;
export const LIVE_STAGE_AT_MS = [0, 12_000, 35_000] as const;
// How often the gate asks GET /api/viewing/status during a live call, and when it
// gives up waiting for the booking webhook.
export const LIVE_POLL_MS = 2_500;
export const LIVE_CALL_TIMEOUT_MS = 240_000;
// Pause on the final transcript line before the booked check lands.
export const CONFIRM_HOLD_MS = 1_200;

// Canonical home is ~/lib/constants (chat tools read it); re-exported so the
// frozen (flow) surface keeps compiling.
export { AUTO_CALL_MATCH_THRESHOLD } from "~/lib/constants";

// Client poll cadence for /api/adaptation/[jobId] while a job is non-terminal.
// Read by the client-side AdaptationStatus component.
export const ADAPTATION_POLL_INTERVAL_MS = 4000;
