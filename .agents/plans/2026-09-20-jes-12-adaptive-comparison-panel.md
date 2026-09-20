# JES-12: trigger Devin from feedback to build an adaptive comparison panel

Branch `feat/jes-12/adaptive-comparison-panel` from `origin/main` at `b13ab57`.
Ticket: a JES-8 rejection event starts a real Devin API session that returns a bounded,
declarative `ComparisonPanelSpec`; a deterministic validator gates it; trusted React
renders it. One artifact family, one session per explicit rejection, no general builder.

## Source-of-truth check (what main already has)

- Feedback event contract: `packages/contract/src/feedback.ts` (`FeedbackEventSchema`,
  `ProfileVersionSchema` = `sha256:<64 hex>`, `FEEDBACK_REASONS` =
  `too_expensive | wrong_area | missing_balcony`).
- Feedback store: `apps/web/lib/feedback.ts` (`getFeedbackEvent(userId, eventId)`,
  `listActiveFeedback`, `clearUserFeedback` registered in `demoUserCleanups`), table
  `listing_feedback` in `apps/web/lib/db/schema.ts`, migration `0006_equal_stellaris.sql`.
- Profile version: `apps/web/lib/profile-version.ts` `getProfileVersion(profile)`; the
  docs (`docs/jes-8-feedback.md`) name it the single version source. No int column needed.
- Client seam: `apps/web/lib/flow/use-listing-feedback.ts` `useListingFeedback(onSaved)`;
  `onSaved(event)` runs after persistence. Consumers: `components/flow/explore/ExploreFeed.tsx`
  (`router.refresh()`), `components/flow/match/AgentCallGate.tsx` (`setFeedback`).
- Feed page: `app/(flow)/explore/page.tsx` server-renders `buildFeed` + `listActiveFeedback`
  and passes `feedback` to `ExploreFeed`. Detail page redirects rejected listings to
  `/explore` (`app/(flow)/explore/[id]/page.tsx`).
- Route exemplar + tests: `app/api/feedback/route.ts`, `route.test.ts` (auth via `auth()`,
  same-origin check, JSON content type, Valibot `safeParse`, mocked lib module).
- Polling primitive already in use: `swr` (`components/flow/match/MatchExplanation.tsx`).
- Env seam: `apps/web/lib/env.ts` (Valibot, `VIEWING_MODE` fallback pattern). Constants:
  `apps/web/lib/constants.ts`.
- Demo reset: `apps/web/lib/demo/reset.ts` `demoUserCleanups`.
- Devin API v3 (verified 2026-09-20 from `docs.devin.ai` OpenAPI):
  - `POST /v3/organizations/{org_id}/sessions` body `{ prompt (required),
structured_output_schema (JSON Schema Draft 7, <=64KB, self-contained),
structured_output_required, max_acu_limit, title, tags, resumable }`.
    Permission `UseDevinSessions`.
  - `GET /v3/organizations/{org_id}/sessions/{devin_id}` where `devin_id` is the session id
    prefixed `devin-`. Response: `session_id, url, status
(new|claimed|running|exit|error|suspended|resuming), status_detail
(working|waiting_for_user|waiting_for_approval|finished|inactivity|user_request|
usage_limit_exceeded|out_of_credits|out_of_quota|no_quota_allocation|
payment_declined|org_usage_limit_exceeded|user_usage_limit_exceeded|
total_session_limit_exceeded|error|null), structured_output (object|null)`.
  - `POST .../sessions/{devin_id}/messages` body `{ message }`. Permission
    `ManageOrgSessions`.
  - Auth: `Authorization: Bearer cog_...` (service user key or Personal Access Token).
- Credentials (proven 2026-09-20): the account key is a v1 personal API key
  (`apk_user_...`). Against v3 it returns `403 Forbidden`; against v1 `GET /v1/sessions`
  returns 200. So the client targets **v1** (verified from the v1 OpenAPI):
  - `POST /v1/sessions` body `{ prompt (required), structured_output_schema (Draft 7,
<=64KB), max_acu_limit, title, tags, unlisted, idempotent }` → `{ session_id, url,
is_new_session }`. No `structured_output_required` in v1.
  - `GET /v1/sessions/{session_id}` → `{ session_id, url?, status (string), status_enum
(working|blocked|expired|finished|suspend_requested|suspend_requested_frontend|
resume_requested|resume_requested_frontend|resumed|null), structured_output
(any|null), title, created_at, updated_at }`.
  - `POST /v1/sessions/{session_id}/message` body `{ message }` (singular `message`).
  - Auth: `Authorization: Bearer <key>`; `DEVIN_ORG_ID` is not needed for v1 but stays in
    env for the day a `cog_` key arrives. `DEVIN_API_BASE_URL` default `https://api.devin.ai`.
    The implementation ships `ADAPTATION_MODE=mock` (default) so it builds and tests without
    a key; `.env.local` in the worktree has `ADAPTATION_MODE=devin` for the acceptance run.
    The key was shared in chat and must be rotated after the hackathon.

## Design

### Contract (`packages/contract/src/adaptation.ts`, re-exported from `index.ts`)

```ts
export const COMPARISON_FIELDS = ["price", "area", "balcony", "rooms", "size"] as const;
export const COMPARISON_ACTIONS = ["open_listing", "edit_preferences"] as const;
export const FOCUS_FIELD: Record<FeedbackReason, ComparisonField> = {
  too_expensive: "price", wrong_area: "area", missing_balcony: "balcony",
};
export const ComparisonPanelSpecSchema = v.strictObject({
  schemaVersion: v.literal(1),
  feedbackEventId: uuid,
  profileVersion: ProfileVersionSchema,
  focus: FeedbackReasonSchema,
  attempt: v.pipe(v.number(), v.integer(), v.minValue(1)),  // echoed from the prompt; 1 here
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  listingIds: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
    v.minLength(2), v.maxLength(3), unique),
  rows: v.pipe(v.array(v.strictObject({
    field: v.picklist(COMPARISON_FIELDS),
    label: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
    note: v.optional(v.pipe(v.string(), v.maxLength(140))),
  })), v.minLength(1), v.maxLength(4), uniqueBy field),
  actions: v.pipe(v.array(v.picklist(COMPARISON_ACTIONS)), v.maxLength(2), unique),
});
export const comparisonPanelJsonSchema: Record<string, unknown> // Draft 7 twin, built
  // from the same constants (enums, min/max) so the two cannot drift.
export const PANEL_ERROR_CODES = ["schema","wrong_attempt","wrong_event","stale_profile",
  "wrong_focus","unknown_listing","missing_required_row"] as const;   // JES-13 appends
export const PanelValidationErrorSchema = v.strictObject({
  code: v.picklist(PANEL_ERROR_CODES), path: v.string(), message: v.string() });
export const ADAPTATION_STATUSES = ["queued","running","validating","ready","failed","stale"] as const;
export const AdaptationJobSchema = v.strictObject({
  jobId: uuid, feedbackEventId: uuid, status: v.picklist(ADAPTATION_STATUSES),
  provider: v.picklist(["devin", "mock"]), attempt: v.number(),
  sessionUrl: v.nullable(v.pipe(v.string(), v.url())),
  panel: v.nullable(ComparisonPanelSpecSchema),   // only when status === "ready"
  error: v.nullable(v.string()),                   // safe user-facing message only
  updatedAt: isoTimestamp,
});
export const AdaptationInputSchema = v.strictObject({ eventId: uuid });
export const AdaptationOutputSchema = v.strictObject({ job: AdaptationJobSchema });
```

Display values are NOT in the spec; trusted code resolves them from `Listing` rows.
Tests: table of valid/invalid specs; JSON-schema twin: `required` equals Valibot keys,
enums equal the constants, array bounds equal.

### DB (`apps/web/lib/db/schema.ts`, migration `0007_*` via `drizzle-kit generate`)

Table `adaptation_job`: `id uuid pk default`, `user_id uuid fk User cascade`,
`feedback_event_id uuid not null`, `profile_version text not null`, `status text not null`,
`provider text not null` (`devin|mock`), `attempt integer not null default 0`,
`source_listing_ids jsonb not null default []` (the candidate set handed to the provider;
the validator's allowlist), `provider_session_id text`, `provider_session_url text`,
`candidate_spec jsonb`, `accepted_spec jsonb`, `validation_errors jsonb`, `error text`,
`deadline_at timestamp not null`, `created_at`, `updated_at`.
Unique index `(user_id, feedback_event_id)` = dedupe. `clearUserAdaptations` registered in
`demoUserCleanups` (`lib/demo/reset.ts`). No change to `SearchProfile`.

### Env + constants

`lib/env.ts`: `ADAPTATION_MODE: v.fallback(v.picklist(["mock","devin"]), "mock")`,
`DEVIN_API_KEY`, `DEVIN_ORG_ID` optional, `DEVIN_API_BASE_URL: v.fallback(v.string(),
"https://api.devin.ai")`. `ADAPTATION_MODE=devin` with a missing key/org fails the job
with a safe message (never throws at import). `lib/constants.ts`: `ADAPTATION_DEADLINE_MS`
(10 min), `ADAPTATION_POLL_INTERVAL_MS` (4000), `ADAPTATION_MAX_ATTEMPTS` (2),
`ADAPTATION_MAX_ACU` (1), `ADAPTATION_CANDIDATE_LIMIT` (6), `DEVIN_REQUEST_TIMEOUT_MS`
(10_000), each with a one-line comment. `.env.example` documents the four vars.

### Devin client (`apps/web/lib/devin/client.ts`, `client.test.ts`)

```ts
// Provider-neutral phase so the machine never sees raw Devin status strings.
export type DevinPhase = "working" | "finished" | "blocked" | "ended";
export interface DevinSessionSnapshot { sessionId: string; url: string;
  phase: DevinPhase; structuredOutput?: unknown }
export interface DevinClient {
  createSession(input: { title: string; prompt: string; schema: Record<string, unknown> }): Promise<DevinSessionSnapshot>;
  getSession(sessionId: string): Promise<DevinSessionSnapshot>;
  sendMessage(sessionId: string, message: string): Promise<void>;
}
export const createDevinClient = (config: { apiKey: string; baseUrl: string }, fetchImpl = fetch): DevinClient
export const createMockDevinClient = (context): DevinClient  // in-memory, deterministic
```

Real client (v1): `Authorization: Bearer`, `AbortSignal.timeout(DEVIN_REQUEST_TIMEOUT_MS)`,
create body `{ prompt, structured_output_schema, max_acu_limit: ADAPTATION_MAX_ACU, title,
unlisted: true }`; the create response has no status, so `createSession` returns
`phase: "working"` with the returned `session_id`/`url`. `getSession` maps `status_enum`:
`finished` → finished; `blocked` → blocked; `expired` → ended; everything else including
`null` → working; `url` falls back to `https://app.devin.ai/sessions/<id without devin->`
when absent. Responses parsed with `v.looseObject`. Errors become `DevinClientError(status)`;
the message never includes the key or the request body.
Mock client: `createSession` returns `running/working`; the second `getSession` returns
`running/finished` with a structured output built from `MOCK_CONTEXT` the runner stashes
on the client via `createMockDevinClient({ candidates, event })`. Deterministic: for
`missing_balcony` pick listings with `balcony|terrace` amenities first, rows =
`[focus, price, area]`, actions `[open_listing, edit_preferences]`.
Tests (mocked `fetch`): URL/method/headers/body shape for the three calls, `devin-` prefix
handling (accept ids with or without the prefix, send prefixed), non-2xx maps to
`DevinClientError` without leaking the key, timeout maps to a failure.

### Deterministic validator (`apps/web/lib/adaptation/validate.ts`, `validate.test.ts`)

```ts
export interface ValidationContext { feedbackEventId: string; profileVersion: string;
  focus: FeedbackReason; sourceListingIds: readonly string[]; expectedAttempt: number }
export const validateComparisonPanel = (candidate: unknown, ctx):
  { ok: true; spec: ComparisonPanelSpec } | { ok: false; errors: PanelValidationError[] }
```

Rules (all errors collected, table-tested, each mapped to a `PANEL_ERROR_CODES` code with
the offending dot path): Valibot parse (`schema`, Valibot dot path); `attempt ===
ctx.expectedAttempt` (`wrong_attempt`); `feedbackEventId === ctx` (`wrong_event`);
`profileVersion === ctx` (`stale_profile`); `focus === ctx.focus` (`wrong_focus`); every
`listingIds[i]` is in `sourceListingIds` (`unknown_listing`, path `listingIds.<i>`); `rows`
contains `FOCUS_FIELD[focus]` (`missing_required_row`, path `rows`). This is the JES-13
seam: JES-13 extends `ValidationContext`, appends codes, and adds semantic checks; the
signature stays.

### State machine (`lib/adaptation/machine.ts` pure, `machine.test.ts`) and runner (`lib/adaptation/runner.ts`)

Pure step: `nextStep(job, input) → { patch: Partial<JobRow>; effect?: Effect }` where
`input` is one of `{ kind: "claim" }`, `{ kind: "snapshot"; snapshot: DevinSessionSnapshot }`,
`{ kind: "provider_error"; message }`, `{ kind: "stale" }`, `{ kind: "timeout" }` and
`Effect` is `create_session | none`. `attempt` is 1 from the claim onward
(`ADAPTATION_MAX_ATTEMPTS = 1`). Correction retries after an invalid candidate are
**JES-13 scope** and are deliberately absent here; the client keeps `sendMessage` for it.
Transitions:

| from               | input                                                      | to                                | notes                                                                                |
| ------------------ | ---------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| queued             | claim                                                      | running                           | effect `create_session`, `attempt = 1`                                               |
| running            | snapshot phase `working`, no output                        | running                           | keep polling                                                                         |
| running            | snapshot with `structuredOutput` (any phase)               | ready (valid) or failed (invalid) | `candidate_spec` + `validation_errors` (PanelValidationError[]) stored in both cases |
| running            | snapshot phase `finished`, `blocked` or `ended`, no output | failed                            | "Devin session ended without a result" (v1 has no `structured_output_required`)      |
| any non-terminal   | stale                                                      | stale                             | never writes `accepted_spec`                                                         |
| any non-terminal   | timeout                                                    | failed                            | "Timed out"                                                                          |
| ready/failed/stale | anything                                                   | unchanged                         | terminal                                                                             |

Runner glue:

- `startAdaptation(userId, eventId)`: `getFeedbackEvent` (owner-scoped; 404 if absent,
  409 if `undoneAt`); `getProfile` + `getProfileVersion`; `insert ... onConflictDoNothing`
  on `(user_id, feedback_event_id)` then `select` (dedupe: repeated submission returns the
  same job). Inserts `queued` only; no provider call in POST (keeps the feed refresh fast).
- `advanceAdaptation(userId, jobId)`: one step per call, owner-scoped select (undefined for
  foreign → route 404). Order: terminal → return; `getFeedbackEvent` undone or
  `getProfileVersion(currentProfile) !== job.profileVersion` → `stale`; `now > deadline_at`
  → `timeout`; `queued` → `UPDATE adaptation_job SET status='running', updated_at=now()
WHERE id=? AND status='queued' RETURNING` (two-tab race: only the winner creates the
  session; the loser just returns the row); winner builds candidates (`buildFeed(profile,
undefined, undefined, feedback)` top `ADAPTATION_CANDIDATE_LIMIT`, sanitized to
  `{ id, title, priceEur, neighbourhood, rooms, builtM2, amenities }`) plus the rejected
  listing's facts, stores `source_listing_ids`, calls `createSession` (mock or devin per
  `env.ADAPTATION_MODE`), stores id/url; on client error → `provider_error` → failed.
  `running` → `getSession` → `snapshot` step; `send_retry` effect sends the validation
  errors as a message; DB patch applied with `WHERE id=? AND status=<from>` so concurrent
  ticks cannot double-apply.
- `getLatestAcceptedPanel(userId)`: newest `ready` job whose feedback event is still
  active (join `listing_feedback.undone_at IS NULL`); returns `{ job, spec, rows: Listing[] }`.
- `getActiveJob(userId)`: newest non-terminal job for an active event (for reload resume).
- `toAdaptationJob(row)` builds the wire shape; `candidate_spec`, `validation_errors`,
  `provider_session_id`, `source_listing_ids` are never serialized. `error` is one of a
  fixed set of safe strings.

### Prompt (`lib/adaptation/prompt.ts`, `prompt.test.ts`)

`buildAdaptationPrompt({ event, rejected, candidates, schema })`: English; states the goal
(compare 2 or 3 of the candidate listings around what the user disliked), lists the
rejected listing facts and each candidate with its id and sanitized facts, gives
`feedbackEventId`, `profileVersion`, `focus`, the exact `attempt` number to echo (1),
restates hard rules (ids only from the list,
rows must include the focus field, no display values, no browsing/cloning/network, answer
only via structured output). Test: contains every candidate id, the event id and version,
and no field outside the sanitized set (no URLs, publisher names, descriptions).

### Routes

- `POST /api/adaptation` (`app/api/adaptation/route.ts`): `auth()` 401; same-origin 403;
  JSON 415; `AdaptationInputSchema` 400; `startAdaptation` → 202 `{ job }`;
  `AdaptationError(status)` mapped like `FeedbackError`; unknown → 500 generic.
- `GET /api/adaptation/[jobId]` (`app/api/adaptation/[jobId]/route.ts`): `auth()` 401;
  `advanceAdaptation` → 404 when undefined; 200 `{ job }` with `Cache-Control: private,
no-store`.
- Route tests mirror `app/api/feedback/route.test.ts` (mock `~/lib/adaptation/runner`):
  401 for both, 404 for foreign job, response body validated against
  `AdaptationOutputSchema` (strict, so leaks fail), body text does not contain
  `candidate`, `cog_`, `provider_session_id`; cross-origin 403; 500 hides internals.

### UI

- `lib/adaptation/resolve.ts` (+ test): `resolvePanel(spec, rows: Listing[]) → ResolvedPanel
{ title, columns: [{ listingId, title }], rows: [{ field, label, note, cells: string[] }],
actions }`. Cells: price `€1.700/mo` from `priceEur` else `Unknown`; area
  `neighbourhood ?? district ?? Unknown`; balcony `Balcony listed` / `Terrace listed` /
  `Not listed` (from `amenities`, never inferred); rooms `n rooms` else `Unknown`; size
  `72 m²` from `builtM2` else `Unknown`. Missing row → the whole column shows `Unknown`.
- `components/flow/explore/ComparisonPanel.tsx` (server-renderable, no client state):
  `<section aria-label="Adaptive comparison">` with provenance line ("Built by a Devin
  session" + `View session` link when `provider === "devin"`; "Simulated panel, no Devin
  session" when mock), a `<table>` (columns = listings, first column = row label +
  note), actions rendered by trusted code: `open_listing` → one `Link` per column to
  `/explore/[id]`; `edit_preferences` → `Link` to `/onboarding`. Flow tokens
  (`rounded-cards bg-snow shadow-sm`, `FlowButton`), 44px targets, no horizontal overflow
  at 375px (table scrolls inside its container).
- `components/flow/explore/AdaptationStatus.tsx` (client): props `{ job: AdaptationJob }`;
  `useSWR([`/api/adaptation/${job.jobId}`], fetcher, { fallbackData: job, refreshInterval:
(latest) => isTerminal(latest) ? 0 : ADAPTATION_POLL_INTERVAL_MS, revalidateOnFocus:
false })`; when the polled status becomes `ready` call `router.refresh()` once (guard via
  a ref keyed on jobId) so the server renders the panel. Copy per status: queued "Queued
  for Devin", running "Devin is building your comparison" (+ session link), validating
  "Checking the result against your listings", failed "Couldn't build a comparison. Your
  feed is unchanged.", stale "Your preferences changed, so this comparison was discarded."
  Use `role="status"`. No `useEffect`, no `setInterval`.
- `lib/flow/adaptation-client.ts`: `requestAdaptation(eventId): Promise<AdaptationJob |
undefined>` (POST, parse `AdaptationOutputSchema`, swallow errors → undefined).
- Wiring: `ExploreFeed` `useListingFeedback((event) => { void
requestAdaptation(event.eventId).finally(() => router.refresh()); })`; new props
  `panel?: ResolvedPanel & { job: AdaptationJob }` and `job?: AdaptationJob` rendered
  between the carousel and the Undo strip. `app/(flow)/explore/page.tsx` loads
  `getLatestAcceptedPanel` + `getActiveJob`. `AgentCallGate` `onSaved`: `setFeedback(event);
void requestAdaptation(event.eventId);` (panel appears on the feed the detail's Undo strip
  already links to). Undo hides the panel because `getLatestAcceptedPanel` joins on active
  events only.

### Evidence + docs

- `apps/web/scripts/check-adaptation.ts` (real DB, disposable user + listing like
  `check-feedback.ts`): dedupe (two POST-equivalent calls → one row), foreign user → undefined,
  stale after profile edit, undo → stale, reset clears rows.
- With a real key: one genuine run captured to `apps/web/tests/fixtures/devin-adaptation-run.json`
  (request minus key, session id/url, final snapshot). Labeled replay for the demo lives
  in `docs/jes-12-adaptive-panel.md` with the session URL.
- `docs/jes-12-adaptive-panel.md`, `.agents/notes/2026-09-20-jes12.md`, `.agents/MEMORY.md`
  one-liner on `ADAPTATION_MODE`.

## Verification rounds

- Round 0: every seam above cites a file read on `main` at `b13ab57`; Devin shapes cite
  the OpenAPI pulled 2026-09-20. Open items code cannot answer: Devin key/org id (user).
- Round 1 audits: security (owner scoping on every read/write, key server-only, response
  strict-parsed, no `dangerouslySetInnerHTML`, actions allowlisted, listing ids
  allowlisted); correctness (conditional UPDATEs for claim and every transition; stale
  check before any accept; terminal states immutable); production edges (provider 5xx,
  timeout, waiting_for_user, suspended for credits → failed with safe message; missing key
  in `devin` mode → failed not thrown); tests listed per module; simplicity (two routes,
  one table, one component family, no worker, no `useEffect`).
- Round 2: one session per event, no retries on this branch (JES-13 adds them on top);
  stale never overwrites; reset cleanup transactional; the mock mode
  cannot be mistaken for a real run (provider label).

## Order

contract → schema/migration + env/constants → client (+mock) → validate → machine →
runner → routes → resolve + UI → page wiring → check script → `mise run validate` →
real-run capture (needs key) → docs.
