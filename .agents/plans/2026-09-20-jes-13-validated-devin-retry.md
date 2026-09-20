# JES-13: validate Devin output and return failures for one autonomous retry

Branch `feat/jes-13/validated-devin-retry`, worktree `~/.worktrees/jes-13/validated-devin-retry`.
Stacked on JES-12 PR #54 (`feat/jes-12/adaptive-comparison-panel`, head `3957bd7`) with
`main` (`b2dd2a7`) merged in (`e715b2e`). Sync `main` and #54 into this branch often.

## What JES-12 (#54) already provides (verified in code on 3957bd7)

- Contract `packages/contract/src/adaptation.ts`: `ComparisonPanelSpecSchema` (with `attempt`),
  Draft 7 twin, `FOCUS_FIELD`, `PANEL_ERROR_CODES` (7 codes), `PanelValidationErrorSchema`,
  `ADAPTATION_STATUSES = queued|running|validating|ready|failed|stale`, `AdaptationJobSchema`.
- `adaptation_job` table (migration `0009_solid_living_lightning`), unique `(user_id,
feedback_event_id)`, single `candidate_spec` / `accepted_spec` / `validation_errors` columns.
- Pure `nextStep(job, input)` (`lib/adaptation/machine.ts`), pure `validateComparisonPanel(candidate,
ctx)` (`lib/adaptation/validate.ts`), `runner.ts` (claim with conditional UPDATE, poll, stale,
  timeout, `getLatestAcceptedPanel`, `getActiveJob`), `prompt.ts`, `resolve.ts` (cells computed
  from Listing rows; the spec carries no display values), Devin v1 client + mock
  (`lib/devin/client.ts`, `sendMessage` implemented but unused), routes `POST /api/adaptation`,
  `GET /api/adaptation/[jobId]`, `AdaptationStatus` (swr poll), `ComparisonPanel`, explore page
  wiring, `scripts/check-adaptation.ts` (mock provider on real pg0), `docs/jes-12-adaptive-panel.md`.
- `ADAPTATION_MAX_ATTEMPTS = 1`; an invalid final candidate fails the job. Invalid output while
  the session phase is `working` is ignored (non-final).
- Real run on 2026-09-20 hit `403 out_of_quota`; the account has credits again now.

## Defects JES-13 fixes on top

1. After a correction message `GET /v1/sessions/{id}` still returns the previous
   `structured_output`; nothing tells "new candidate" from "not yet".
2. Attempt 1 would be overwritten by the single job columns; both outputs and exact errors
   must be preserved.
3. No semantic gate (rejected listing, red line, unsafe text, usefulness), no correction, no
   trace, no deliberate new attempt after terminal failure.

## Design (settled)

### Contract (`packages/contract/src/adaptation.ts`)

- `ADAPTATION_STATUSES`: insert `"correcting"` after `"running"`.
- `PANEL_ERROR_CODES` append: `"rejected_listing"`, `"red_line_violation"`, `"unsafe_text"`,
  `"no_improvement"`.
- `TRACE_STEPS = ["triggered","session_created","proposed","rejected","correcting","accepted",
"failed","stale","retried"]`; `TraceEventSchema = v.strictObject({ at: isoTimestamp, step:
picklist, attempt: optional(integer), run: optional(integer), errors:
optional(array(PanelValidationErrorSchema)), sessionId: optional(string), message:
optional(string) })`. No spec content ever enters the trace.
- `AdaptationJobSchema` add `run: v.number()` and `trace: v.array(TraceEventSchema)`.

### Persistence (migration `0010`)

- `adaptation_job` add `run integer not null default 1`, `trace jsonb not null default '[]'`.
- New `adaptation_candidate`: `id uuid pk`, `job_id uuid fk adaptation_job on delete cascade`,
  `run int`, `attempt int`, `provider_session_id text`, `spec jsonb not null` (raw provider
  output, unknown), `hash text not null`, `errors jsonb not null default '[]'`, `accepted bool
not null default false`, `created_at`. Unique `(job_id, run, attempt)`. Rendering never reads
  this table; `accepted_spec` on the job stays the only render source.
- Job `candidate_spec` / `validation_errors` keep meaning "latest judged candidate".

### Hashing (`lib/adaptation/hash.ts`)

`canonicalJson(value)` (recursive key sort) and `hashCandidate(value) = "sha256:" + sha256`.
Same style as `lib/profile-version.ts`.

### Machine (`lib/adaptation/machine.ts`)

- `nextStep(job, input, now = new Date())`: third optional param so trace timestamps stay pure.
- `AdaptationStepInput.snapshot` gains `priorHashes: readonly string[]`.
- `AdaptationStep` gains `candidate?: { attempt, spec, hash, errors, accepted }` (the runner
  inserts it in the same transaction as the conditional UPDATE).
- Effects: add `{ kind: "send_correction"; errors: PanelValidationError[]; attempt: number }`.
- `running` + final invalid candidate (phase not `working`) and `job.attempt <
ADAPTATION_MAX_ATTEMPTS`: patch `{ status: "correcting", attempt: job.attempt + 1,
candidateSpec, validationErrors, trace: +proposed +rejected(errors) +correcting }`, effect
  `send_correction`, candidate record (accepted false). Otherwise (budget spent) fail with
  `ADAPTATION_ERRORS.exhausted`.
- `correcting` + snapshot: output undefined or `hash ∈ priorHashes` means "not yet" (unchanged)
  unless phase is `ended` (fail `noResult`). New hash: validate with `expectedAttempt =
job.attempt`; ok in any phase → `ready` (+accepted trace, candidate accepted true); invalid +
  `working` → unchanged; invalid + terminal → `failed` with
  `ADAPTATION_ERRORS.exhausted`, candidate record, trace +proposed +rejected +failed.
- `stale`, `timeout`, `provider_error` apply from `correcting` too (they already do) and append
  the matching trace step.
- `ADAPTATION_ERRORS.exhausted = "Devin's corrected comparison still didn't match your
listings. Your feed is unchanged."`

### Validator (`lib/adaptation/validate.ts`, signature unchanged)

`ValidationContext` gains `rejectedListingId: string` (the event's listing),
`rejectedListingIds: readonly string[]` (all active feedback listing ids, includes the event's),
`redLineListingIds: readonly string[]`, `facts: Readonly<Record<string, CandidateFacts>>`
(candidates and the rejected listing, sanitized). Checks appended after the existing ones:

- `rejected_listing` (`listingIds.i`): id in `rejectedListingIds`.
- `red_line_violation` (`listingIds.i`): id in `redLineListingIds`.
- `unsafe_text` (`title`, `rows.i.label`, `rows.i.note`): matches
  `/https?:\/\/|www\.|<\/?[a-z!]|javascript:|data:|\bon\w+\s*=/i`.
- `no_improvement` (`listingIds`): none of the selected listings improves on the rejected
  listing for the focus. Improvement per focus: `too_expensive` price known on both sides and
  strictly lower; `missing_balcony` amenities match `/balcony|terrace/i` (absent is unknown,
  never counts either way); `wrong_area` neighbourhood known and different. The check only
  fires when at least one allowlisted, non-rejected, non-red-line candidate improves; if none
  can, it is vacuous (the gate demands the best available, not the impossible).

`violatesRedLines(profile, row)` is extracted from `rankListings` in `lib/match.ts` and reused by
the runner to compute `redLineListingIds` from fresh Listing rows.

### Runner (`lib/adaptation/runner.ts`)

- `startAdaptation`: insert trace `[triggered]`. `claimJob`: append `session_created` with
  `sessionId` in the session-store UPDATE.
- `pollJob(row, event, focus, profile)`: load Listing rows for `sourceListingIds` +
  `event.listingId`, active feedback → `rejectedListingIds`, `violatesRedLines` →
  `redLineListingIds`, `sanitizeCandidate` → `facts`, prior hashes from `adaptation_candidate`
  for `(jobId, run)`.
- `applyStep`: `db.transaction`: conditional UPDATE `WHERE id AND status = from`; if a row came
  back and `step.candidate` exists, insert candidate row. After commit, `send_correction` →
  `client.sendMessage(sessionId, buildCorrectionPrompt(...))`; failure → `provider_error`.
  Update-then-send means at most one message per attempt across tabs.
- `buildCorrectionPrompt({ errors, attempt, event, focus, rejected, candidates, schema })` in
  `prompt.ts`: says the previous structured output was rejected by an automated validator,
  lists the errors as JSON, restates the required values (with the new `attempt`), the hard
  rules, the candidate allowlist facts and the schema, and asks for a fresh structured output.
- `retryAdaptation(userId, jobId)`: only from `failed`; event still active, still a focus and
  profile version unchanged (else 409). Conditional UPDATE: `status queued, attempt 0, run
run+1, error null, candidate_spec null, validation_errors null, provider_session_id null,
provider_session_url null, deadline_at now+DEADLINE, trace +retried(run)`. Candidates of
  earlier runs stay. `stale` jobs are not retryable (a new rejection makes a new event).
- `getActiveJob` → returns the newest job for an active event with status in `queued | running
| correcting | failed` (so the failure and its "Try again" survive a reload). `ready` is
  served by `getLatestAcceptedPanel`; `stale` is dropped.
- `toAdaptationJob` adds `run`, `trace`.

### Routes

`POST /api/adaptation/[jobId]/retry`: auth 401, origin 403, uuid check 404, `retryAdaptation` →
202 `{ job }`, `AdaptationError` → its status.

### Mock provider scenarios (test-only, labelled)

Env `ADAPTATION_MOCK_SCENARIO: valid | invalid_first | invalid_twice` (default `valid`,
documented in `.env.example` as a test fixture, never a sponsor proof). `invalid_first`: attempt
1 publishes (phase `blocked`, like a sleeping Devin session) a spec with an unknown listing id
and without the focus row; after `sendMessage` the next poll is `working`, then `blocked` with a
valid spec echoing `attempt: 2`. `invalid_twice`: attempt 2 is invalid again. Mock output must
carry `attempt` from the prompt.

### Constants

`ADAPTATION_MAX_ATTEMPTS = 2` (one correction, two candidates total per run).

### UI (second handoff)

- `AdaptationStatus`: `correcting` copy ("Devin's first comparison was rejected by the validator
  ({n} issues). Asking it to correct."), `failed` shows the error plus a "Try again" button
  (POST retry, then swr `mutate`), compact `AdaptationTrace` list (step label, time, error
  codes) under the status.
- `ComparisonPanel`: when the trace contains `rejected`, a line "Accepted on attempt N after
  one validator correction" with a `<details>` trace.
- Playwright `tests/e2e/explore-adaptation.test.ts` (mock, `ADAPTATION_MOCK_SCENARIO`
  `invalid_first` and `invalid_twice`): rejection → status → correcting → panel; failure → Try
  again → new run; reload keeps the state; the panel never shows an unaccepted candidate.

### Real run (third handoff)

Dev server in `ADAPTATION_MODE=devin` on its own database and port; Playwright drives reset →
reject (`missing_balcony`) → wait for terminal. Export `docs/jes-13/run-<timestamp>/`
(`job.json` trace, `candidates.json` both raw outputs + exact errors, session id, screenshot).
If attempt 1 is accepted on the first try, the proof item "genuine rejected first candidate"
is marked incomplete; nothing is staged.

## Tests (acceptance mapping)

| Acceptance case | Test |
| --- | --- |
| valid output | `validate.test.ts` ok; `machine.test.ts` running → ready |
| unknown listing / action | `unknown_listing`; `schema` on `actions.0` |
| unsupported field | `schema` on `rows.0.field` |
| missing reason-specific row | table over the three focuses |
| hard-constraint violation | `rejected_listing`, `red_line_violation`, `unsafe_text` |
| stale profile | `stale_profile` code; `stale` step from `correcting` |
| retry exhaustion | machine: correcting + new invalid final → failed exhausted; check script `invalid_twice` |
| successful correction | machine: running → correcting (effect + candidate) → correcting + new valid → ready; check script `invalid_first` |
| refresh does not reset budget | check script: repeated `advanceAdaptation` while correcting sends one message; GET never resets `run`/`attempt` |
| deliberate new attempt | check script + route test for `/retry` (failed → run 2 → queued; not from stale) |

## Order

1. Contract + migration 0010 + hash + `violatesRedLines` + validator + machine (+ tests).
2. Runner (transactional step, correction message, retry, trace) + route + mock scenarios +
   check script.
3. UI + Playwright e2e in mock mode.
4. Real Devin run, export, docs (`docs/jes-13-validated-retry.md`), dated note, pre-flight
   review, stacked PR against `feat/jes-12/adaptive-comparison-panel`.
