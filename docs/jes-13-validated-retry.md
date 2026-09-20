# Validate Devin output and return failures for one autonomous retry (JES-13)

Stacked on the JES-12 producer (`docs/jes-12-adaptive-panel.md`). Every structured output a
Devin session publishes for the comparison panel passes an independent, deterministic gate
before anything renders. A refused first candidate is sent back to the same session with its
exact machine-readable errors; the session gets one correction; a second refusal or the
deadline fails the job and the feed keeps its previous trusted state. A model saying its
output is valid is never sufficient: `accepted_spec` is written by the validator only.

## What ships

- `packages/contract/src/adaptation.ts`: status `correcting`; error codes `rejected_listing`,
  `red_line_violation`, `unsafe_text`, `no_improvement` appended to `PANEL_ERROR_CODES`;
  `TraceEventSchema` (`triggered | session_created | proposed | rejected | correcting |
accepted | failed | stale | retried`, timestamps and codes only, never candidate content);
  `AdaptationJobSchema` gains `run` and `trace`.
- Migration `0010_open_whistler`: `adaptation_candidate` (every judged output with its
  `hash`, `errors`, `accepted`, `provider_session_id`; unique `(job_id, run, attempt)`) and
  `adaptation_job.run` / `adaptation_job.trace`. Rendering never reads `adaptation_candidate`.
- `apps/web/lib/adaptation/validate.ts`: `validateComparisonPanel(candidate, ctx)` keeps its
  signature and adds the semantic checks. `ValidationContext` now carries the event's listing,
  every actively rejected listing, the allowlisted listings that violate a profile red line
  (`violatesRedLines`, extracted from `lib/match.ts`) and the trusted facts of every candidate.
- `apps/web/lib/adaptation/hash.ts`: canonical JSON + `sha256` of a candidate. After a
  correction message `GET /v1/sessions/{id}` still returns the previous `structured_output`;
  a candidate is new only when its hash is not among the run's judged candidates.
- `apps/web/lib/adaptation/machine.ts`: pure `nextStep(job, input, now)`. A final invalid
  candidate on attempt 1 moves the job to `correcting` (attempt 2) with a `send_correction`
  effect; the judged candidate is returned for persistence. In `correcting`, the previous
  output (same hash) is "not yet"; a fresh valid output is accepted; a fresh invalid final
  output fails with `ADAPTATION_ERRORS.exhausted`. `ADAPTATION_MAX_ATTEMPTS = 2`.
- `apps/web/lib/adaptation/runner.ts`: the step's conditional `UPDATE ... WHERE status = <from>`
  and the candidate insert share one transaction, so a candidate row exists exactly when its
  patch landed; the correction message (`buildCorrectionPrompt`: errors as JSON plus every
  original constraint and the schema) is sent only by the tick whose UPDATE won, after the
  status is already `correcting`, so two tabs cannot send two messages. `retryAdaptation`
  reopens a `failed` job as run N+1 (fresh budget, fresh session, earlier candidates kept).
  `getActiveJob` includes `correcting` and `failed` so a reload shows the failure and its
  control instead of hiding it.
- `POST /api/adaptation/[jobId]/retry`: the only way to start a deliberate new attempt.
  Reloads and polls never create a session or reset the budget.
- UI: `AdaptationStatus` shows the `correcting` state ("Attempt 2 of 2"), the failure with a
  "Try again" button, and a collapsible run trace; `ComparisonPanel` states how the accepted
  candidate got through ("Accepted on attempt 2 after the validator refused the first
  candidate.") with the same trace. Mock runs stay labelled "Simulated".
- Test fixtures: `ADAPTATION_MOCK_SCENARIO=valid|invalid_first|invalid_twice` makes the
  simulated first (or both) candidates invalid (one unknown listing id, no focus row). They
  are labelled tests and never presented as the sponsor run.

## Validator checks

| Code | Path | Rule |
| --- | --- | --- |
| `schema` | Valibot dot path | `ComparisonPanelSpecSchema` (limits, enums, unique ids/fields/actions) |
| `wrong_attempt` | `attempt` | must echo the attempt the prompt asked for |
| `wrong_event`, `stale_profile`, `wrong_focus` | field | must match the job's event, `sha256:` profile version and focus |
| `unknown_listing` | `listingIds.i` | not in the candidate set handed to the session |
| `rejected_listing` | `listingIds.i` | actively rejected by the user, including rejections made after the session was briefed |
| `red_line_violation` | `listingIds.i` | violates a profile red line (`no_interior`) on fresh listing rows |
| `missing_required_row` | `rows` | `too_expensive` needs `price`, `wrong_area` needs `area`, `missing_balcony` needs `balcony` |
| `unsafe_text` | `title`, `rows.i.label`, `rows.i.note` | links, markup, `javascript:`/`data:` URLs, inline handlers |
| `no_improvement` | `listingIds` | none of the compared listings beats the rejected one on the focus (cheaper known price, different known neighbourhood, balcony/terrace in the amenities). A listing without amenities text is unknown, never counted either way. Vacuous when no eligible candidate could improve |

Display values are never in the spec; `resolve.ts` recomputes every cell from Listing rows,
so a missing amenity renders as "Not listed" and a null price as "Unknown".

## Runtime

```
queued --claim--> running --valid--> ready
                    |  final invalid, attempt 1
                    v
                correcting --fresh valid--> ready
                    |  fresh final invalid, or session ended
                    v
                  failed --POST /retry--> queued (run+1)
any non-terminal --profile/event drift--> stale ; --deadline--> failed
```

Every transition is a conditional UPDATE on the previous status. The client polls
`GET /api/adaptation/[jobId]` every 4 s; each poll is one step and is idempotent. The
`trace` column records each step with a timestamp; `rejected` steps carry the exact codes.

## Verification

```sh
mise run validate                     # typecheck, lint, format, unit tests
mise run check:adaptation             # mock provider on real pg0, three scenarios
cd apps/web && PORT=3013 ADAPTATION_MOCK_SCENARIO=invalid_first pnpm exec playwright test tests/e2e/explore-adaptation.test.ts
```

Unit tests: `validate.test.ts` (valid output per focus; unknown listing; unknown action;
unsupported field; missing reason row per focus; rejected listing; red-line violator; unsafe
text in title, label and note; stale profile; wrong attempt; `no_improvement` per focus, its
vacuous case and the unknown-amenity case), `machine.test.ts` (correction after a final
invalid first candidate with effect, candidate record and trace; "not yet" on the previous
hash; fresh valid second candidate accepted; fresh invalid second candidate fails, i.e. retry
exhaustion; `wrong_attempt` echo; stale, timeout and provider errors while correcting),
`hash.test.ts`, `prompt.test.ts` (correction message carries the errors, attempt, allowlist,
focus field and schema), `retry/route.test.ts`.

`check:adaptation` on `jes13_qa` (pg0, 300 seeded listings): `invalid_first` ends `ready` on
attempt 2 with two candidate rows (attempt 1 refused with `unknown_listing` +
`missing_required_row`, attempt 2 accepted), trace `triggered, session_created, proposed,
rejected, correcting, proposed, accepted`, `accepted_spec` equal to the second candidate only,
two concurrent polls sending exactly one correction, profile drift while `correcting` going
`stale`; `invalid_twice` ends `failed` with the exhausted message, a repeated trigger or poll
keeps `run 1 / attempt 2`, `retryAdaptation` opens run 2 with a new session and the four
candidates of both runs remain; `ready`, `stale` and foreign jobs cannot be retried.

Browser (Playwright, 390 px, mock provider): `explore-adaptation.test.ts` per scenario. The
refused candidate never renders; the corrected panel shows "Accepted on attempt 2 after the
validator refused the first candidate." with the trace; the failed state survives a reload,
keeps the feed usable and offers "Try again", whose second failure records
"New attempt started (run 2)". Screenshots: `docs/evidence/jes-13/mock-fixtures/` (labelled
Simulated in the UI).

## Judge demo: local flow, then the Devin dashboard

Everything the judge sees locally links to a session they can open in the cloud.

1. Start the app in real mode from the worktree: `cd apps/web && PORT=3013 ADAPTATION_MODE=devin
pnpm dev` (`DEVIN_API_KEY` in `.env.local`, database seeded with `mise run db:seed`).
2. Open `http://localhost:3013/onboarding`, "Show" the demo tools, "Reset and load demo"; the
   feed at `/explore` appears.
3. On the first card press the X ("Discard this candidate"), then "Missing balcony" in
   "Refine the reason". The status line under the carousel reads "Queued for Devin.", then
   "Devin is building your comparison. View session" within about two seconds: the session
   was just created through `POST /v1/sessions`.
4. Click **View session**. It opens `https://app.devin.ai/sessions/<id>` in the Devin
   dashboard: the session title is `Chezy comparison panel: missing_balcony (<event>)`, tagged
   `chezy`, `jes-13`, `missing_balcony`; the prompt shows the rejected listing, the candidate
   allowlist and the JSON schema, and the structured output panel fills in when Devin answers.
5. Back in the app (15 to 40 s later) the comparison panel replaces the status line: "Built by
   a Devin session from your rejection. View session", "Accepted on the first attempt." and a
   "Run trace" disclosure with timestamps (triggered, session started, candidate proposed,
   accepted). The same link opens the same session. If Devin's first answer had been refused,
   the status would read "The validator refused Devin's first comparison. Asking it to
   correct. Attempt 2 of 2." and the trace would list the coded errors and the correction.
6. Open `https://app.devin.ai/sessions` (the organisation's session list): every run appears
   with the `chezy` tag, so the judge sees the agent was called for each rejection, not once.
   Earlier sessions from the same day are listed in the evidence table below.
7. Optional, to show the gate refusing and correcting without waiting for a real refusal:
   restart with `ADAPTATION_MODE=mock ADAPTATION_MOCK_SCENARIO=invalid_first` and repeat step
   3; the UI labels this run "Simulated" and it must be introduced as the labelled test
   fixture, never as the sponsor run.

## Real API runs and acceptance status

Four genuine runs on 2026-09-20 with `ADAPTATION_MODE=devin` (v1 API, `max_acu_limit: 1`),
driven through the real UI by `tests/e2e/live-adaptation.test.ts` (opt-in,
`LIVE_ADAPTATION=1`) and exported with `scripts/export-adaptation-run.ts`. Evidence in
`docs/evidence/jes-13/live-run-2026-09-20/` (job trace with timestamps, every candidate with
its errors, session id, screenshots).

| Run | Focus | Session | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | `missing_balcony` | `devin-fba4e649ba4549f79a7efbc6a586a36c` | accepted on attempt 1, 17 s after session creation | `run1/` (JSON) |
| 2 | `missing_balcony` | `devin-814c910d879a41aeb51bc04d7711dddf` | accepted on attempt 1, 25 s | `run2/` (JSON, `status-building.png`, `accepted.png`) |
| 3 | `missing_balcony` | `devin-562529d2cb1a40ef8d6f07e38a10e336` | accepted on attempt 1, 28 s | `run3/` (JSON) |
| 4 | `too_expensive` | `devin-b093f962ecd346a19844f4782d79e12a` | accepted on attempt 1, 14 s | `run4/` (JSON, `accepted.png`) |
| 5 | `missing_balcony` | `devin-fbf49e46674d40c08d500102166afce9` | accepted on attempt 1, 33 s; first listed and tagged session (`unlisted: false`) | dashboard only |

Devin's first structured output passed every check in all five runs, so no genuine refused
first candidate was captured. Per the ticket, that proof item is **incomplete**: the
correction message, the second candidate and the exhaustion path are proven by the unit
tests, the pg0 check script and the browser run on labelled mock fixtures, not by a live
session. Nothing was staged and no live response was corrupted. The independent gate itself
is real: every live candidate went through `validateComparisonPanel` and `accepted_spec` was
written by the validator, not by the model.

Not done: a live refused first candidate; a Linear update (no Linear access from this machine).
