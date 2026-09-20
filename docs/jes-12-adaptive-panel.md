# Adaptive comparison panel from feedback (JES-12)

A JES-8 rejection event (`listing.rejected`) starts one Devin API session that returns a
bounded, declarative `ComparisonPanelSpec`. A deterministic validator gates it, trusted
React resolves display values from the database and renders the table. One artifact
family, one session per rejection, no general builder.

## What ships

- `packages/contract/src/adaptation.ts`: `ComparisonPanelSpecSchema` (Valibot, strict),
  its Draft 7 twin `comparisonPanelJsonSchema` (built from the same constants), the
  validator error codes, the `AdaptationJob` wire shape and the route input/output schemas.
- `apps/web/lib/db/schema.ts`: table `adaptation_job`, migration `0007_wonderful_boom_boom`.
- `apps/web/lib/devin/client.ts`: v1 Devin API client plus a deterministic mock.
- `apps/web/lib/adaptation/`: `prompt.ts` (sanitized facts and the prompt), `validate.ts`
  (deterministic gate), `machine.ts` (pure `nextStep`), `runner.ts` (database glue),
  `resolve.ts` (display values from `Listing` rows).
- Routes `POST /api/adaptation` and `GET /api/adaptation/[jobId]`.
- Components `ComparisonPanel` (server, trusted rendering and routing) and
  `AdaptationStatus` (client, `swr` polling), wired into `ExploreFeed`, the explore page
  and `AgentCallGate`.
- Env `ADAPTATION_MODE=mock|devin` (default `mock`), `DEVIN_API_KEY`, `DEVIN_ORG_ID`
  (unused by v1), `DEVIN_API_BASE_URL`. Constants in `apps/web/lib/constants.ts` and the
  client poll interval in `apps/web/lib/flow/constants.ts`.

## Contract for JES-13

`ComparisonPanelSpec` v1: `schemaVersion: 1`, `feedbackEventId` (uuid), `profileVersion`
(the JES-8 `sha256:` token), `focus` (an `AdaptationFocus`: `too_expensive | wrong_area |
missing_balcony`; a free-form `other` rejection starts no job and `POST /api/adaptation`
answers 409), `attempt` (integer, min 1,
echoed from the prompt), `title` (1 to 80 chars), `listingIds` (2 to 3 unique ids),
`rows` (1 to 4, unique `field` from `price | area | balcony | rooms | size`, `label`,
optional `note`), `actions` (up to 2 unique from `open_listing | edit_preferences`). No
display values, no URLs, no markup. `FOCUS_FIELD` maps each focus to the row the panel
must contain; `isAdaptationFocus(reason)` is the guard.

`PANEL_ERROR_CODES = schema | wrong_attempt | wrong_event | stale_profile | wrong_focus |
unknown_listing | missing_required_row`; `PanelValidationErrorSchema = { code, path,
message }`. JES-13 appends codes to this list.

Stable signatures JES-13 builds on:

- `validateComparisonPanel(candidate: unknown, ctx: ValidationContext)` returns
  `{ ok: true, spec }` or `{ ok: false, errors: PanelValidationError[] }`.
  `ValidationContext = { feedbackEventId, profileVersion, focus, sourceListingIds,
expectedAttempt }`. Every violation is collected; schema issues carry the Valibot dot
  path.
- `nextStep(job: AdaptationJobRow, input: AdaptationStepInput)` returns `{ patch, effect }`
  and is pure. Inputs: `claim`, `snapshot` (with the validation context),
  `provider_error`, `stale`, `timeout`. Effects: `create_session | none`.
- `adaptation_job` columns: `id`, `user_id`, `feedback_event_id`, `profile_version`,
  `status` (`queued | running | validating | ready | failed | stale`), `provider`
  (`devin | mock`), `attempt`, `source_listing_ids`, `provider_session_id`,
  `provider_session_url`, `candidate_spec`, `accepted_spec`, `validation_errors`,
  `error`, `deadline_at`, `created_at`, `updated_at`. Unique on
  `(user_id, feedback_event_id)`. `candidate_spec` and `validation_errors` are written on
  every validated snapshot, accepted or not.
- `ADAPTATION_MAX_ATTEMPTS = 1`. Correction retries after an invalid candidate, semantic
  checks beyond the list above, the run trace UI and any "Try again" control are JES-13
  scope. `DevinClient.sendMessage` exists and is tested but nothing calls it here.

## Runtime

`POST /api/adaptation` with `{ eventId }` checks the event belongs to the session user and
is not undone, stores the current `getProfileVersion(profile)` and inserts a `queued` job
(`onConflictDoNothing`), returning 202 with the existing job on repeat. No provider call
happens in the POST, so the feed refresh after a rejection stays fast.

`GET /api/adaptation/[jobId]` advances the job by exactly one step for its owner (404 for
anyone else) and returns the wire shape. Order per tick: terminal returns as is; an undone
event or a profile version that no longer matches marks the job `stale` and never writes
`accepted_spec`; a passed `deadline_at` fails it with "Timed out"; `queued` is claimed with
`UPDATE ... WHERE status = 'queued'` so only one tab creates the session; `running` polls
the provider and validates any structured output. A running row without a session id is
the claim window and keeps polling. Every transition is a conditional update on the
status it started from.

Candidate set: the current feed for the profile (with active feedback applied), minus the
rejected listing, first `ADAPTATION_CANDIDATE_LIMIT` items, reduced to `id`, `title`,
`priceEur`, `neighbourhood`, `rooms`, `builtM2`, `amenities`. The ids are stored as
`source_listing_ids` and are the validator's allowlist. Output published while the session
is still `working` is accepted only if valid; invalid output is final only once the phase
is `finished`, `blocked` or `ended`.

The explore page renders the newest `ready` panel whose feedback event is still active
(Undo hides it) and passes the newest non-terminal job to `AdaptationStatus`, which polls
every `ADAPTATION_POLL_INTERVAL_MS` and refreshes the server components once on `ready`.
Failed and stale jobs leave the feed and the last accepted panel untouched. Provenance is
explicit: `provider: devin` shows "Built by a Devin session from your rejection" with a
session link; `provider: mock` shows "Simulated panel. No Devin session was created" and
prefixes live status text with "Simulated:". A mock run is never the sponsor proof.

## Devin API

The account key is a v1 personal API key (`apk_user_...`). Against the v3 organization
endpoints it returns `403 Forbidden`, so the client uses v1:

- `POST /v1/sessions` with `{ prompt, structured_output_schema, max_acu_limit: 1, title,
unlisted: true }` returns `{ session_id, url }`.
- `GET /v1/sessions/{session_id}` returns `status_enum` and `structured_output`. The client
  maps `finished`, `blocked`, `expired` and everything else to the provider-neutral phases
  `finished | blocked | ended | working`.
- `POST /v1/sessions/{session_id}/message` is implemented for JES-13.

v1 has no `structured_output_required`, so a session that ends without output fails the
job. Non-2xx responses become `DevinClientError` with a `code`
(`out_of_quota | unauthorized | http | network | invalid_json`), the HTTP status and the
API's own `detail` text; the message never contains the key or the request body. The
runner logs `status`, `code` and `detail` under `chezy.adaptation` and writes only a fixed
safe string to `adaptation_job.error`.

## Verification

```sh
mise exec -- pnpm --filter @chezy/contract test
# From apps/web:
mise exec -- pnpm vitest run adaptation devin resolve
# From the repository root (mock provider, real pg0, disposable users and listings):
mise run check:adaptation
mise run validate
```

Unit coverage: contract validity table and Draft 7 twin parity, validator rule table,
every machine transition, v1 client URL and body shapes plus the `status_enum` and error
code mappings, prompt contents, resolver cells, route auth, ownership, origin and
no-leak checks. `check:adaptation` proves dedupe on the event id, owner isolation, a mock
run reaching `ready` with ids inside the source set, stale on profile drift, stale on Undo
and cleanup by `resetDemo`.

Browser check (mock provider, dev server on port 3012, Playwright, desktop and 375 px):
"Missing balcony" on the first card produced `POST /api/adaptation`, the status
"Simulated: Devin is building your comparison.", then a panel titled "Homes with outdoor
space" with rows Balcony, Price, Area, cells resolved from stored listings ("Balcony
listed", "Terrace listed", "2.018 €/mo", "Barri Gòtic"), one "Open ..." link per column
and "Edit preferences". Zero console errors, zero horizontal overflow.

## Acceptance status

Blocked on the account, not on the code. With `ADAPTATION_MODE=devin` and the real key,
the rejection created a job and the runner called `POST /v1/sessions`, which returned
`403 {"detail":"Your organization has a billing error. Error: out_of_quota"}` on
2026-09-20. The job failed with "Devin has no session quota right now. Your feed is
unchanged.", the feed stayed intact and the server log recorded the cause. No fixture of a
genuine run exists yet; the mock run is labelled Simulated and does not satisfy the Devin
challenge. Once quota is restored, one rejection in `devin` mode produces the transcript
link on the panel and the run is captured to `apps/web/tests/fixtures/`.
