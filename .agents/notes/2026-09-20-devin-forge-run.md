# Devin forge run 20260920-1239: pisos.com adapter

First end to end run of `scripts/devin-forge` (the Chezy Forge): a Devin cloud
session wrote the pisos.com scraper adapter, an automated verifier on our
machine checked the PR against a standard plus a hidden hold-out, and the PR
was squash-merged. One attempt, no human in the loop after launch.

## Timeline (CEST)

- 12:39 — session created via `POST /v3/organizations/{org}/sessions` (origin
  `api`, mode `normal`, `max_acu_limit` 8, structured output required):
  https://app.devin.ai/sessions/2e94eafbe2374f70a9042ec04e8bca14
- ~12:44 — Devin opened PR https://github.com/espetro/chezy/pull/66 and called
  `provide_structured_output`: 59 passed 1 skipped locally, changed files
  `adapters/pisos.py`, `models.py`, `__main__.py`,
  `packages/contract/src/listings.ts`.
- 12:45:54 — verifier on attempt 1: path allowlist clean, `uv sync`, pytest
  11 passed (6 visible `test_pisos.py` + 5 hidden `test_pisos_holdout.py` on
  the sale page), ruff check clean, ruff format clean, basedpyright 0 errors.
  Verdict `pass` on head `1912475f`. `acus_consumed` reported 0.0 at that
  moment.
- 12:45:57 — `gh pr merge --squash --delete-branch`, merge status 0.

## Incident

The first forge process crashed on a valibot schema mismatch: the v3 API
returns `pull_requests[].pr_url`, not `pull_requests[].url`. Fixed in
`devin.ts`, and the same session was resumed 6 minutes later with the new
`--resume <sessionId> --run-id <id>` flags (see the `session_resumed` event in
the run log). Worth recording honestly: the run below is the resumed process,
not the original one.

## Run log (`scripts/devin-forge/runs/20260920-1239.jsonl`, verbatim)

```jsonl
{"event":"session_created","runId":"20260920-1239","sessionId":"2e94eafbe2374f70a9042ec04e8bca14","url":"https://app.devin.ai/sessions/2e94eafbe2374f70a9042ec04e8bca14","ts":"2026-09-20T10:39:13.797Z"}
{"event":"session_resumed","runId":"20260920-1239","sessionId":"2e94eafbe2374f70a9042ec04e8bca14","url":"https://app.devin.ai/sessions/2e94eafbe2374f70a9042ec04e8bca14","ts":"2026-09-20T10:45:44.001Z"}
{"event":"verdict","attempt":1,"kind":"pass","sha":"1912475f1a9cdfaaaaa3a631804ebd5f277052bb","prUrl":"https://github.com/espetro/chezy/pull/66","acus_consumed":0,"ts":"2026-09-20T10:45:54.651Z"}
{"event":"merged","prUrl":"https://github.com/espetro/chezy/pull/66","mergeStatus":0,"ts":"2026-09-20T10:45:57.876Z"}
```

Gate logs: `/tmp/chezy-forge/logs/20260920-1239-attempt-1-*.log` (uv_sync,
pytest, ruff_check, ruff_format, basedpyright).

## Pre-run verifier proof (no Devin involved)

Two dry runs against throwaway local commits proved the gates before spending
Devin credits:

- Stub `PisosAdapter` (correct `search_url`, `parse_list` returning an empty
  `SearchPage`) -> verdict `fail`, gate `pytest`, 8 failing tests across the
  visible standard and the hidden hold-out.
- Commit that also touched `apps/scraper/README.md` -> verdict `refused`,
  path `apps/scraper/README.md`, tests never ran.

## Post-merge generalisation probe

The adapter was pointed at five live pisos.com pages it had never seen (rent
page 2, casas, habitaciones, sale page 3, gracia district): 33/30/33/30/29
listings parsed, zero listings missing price, lat or title. A live
`uv run scraper scrape --platform pisos --operation rent --tier small` fetched
2 pages and produced 61 new listings, 50 in the small tier.

## Run 2 (20260920-1304): detail-page parser, including a fed-back regression

Second forge run, harder standard: `parse_detail` on the pisos.com adapter.

- 13:04 — session created with `devin_mode: lite`, task `detail` (standard:
  `test_pisos_detail.py` on a rent detail page; hidden hold-out: a sale detail
  page): https://app.devin.ai/sessions/348990fec7134544a9519a8dc18d6c7a
- 13:07:43 — PR https://github.com/espetro/chezy/pull/70 (+220 lines, only
  `adapters/pisos.py`) verified: 13 passed (7 visible + 6 hold-out), ruff and
  basedpyright clean. Merged 13:07:46.
- A live probe of the merged parser on 8 never-seen detail pages (casas,
  casa_adosada, habitaciones, sale piso and atico, two Mallorca listings the
  portal pads results with) found a real crash on the 8th page: bare
  Características rows (`Calefacción`, `Aire acondicionado`, ...) were coerced
  to `True` and pydantic rejected `heating=True`. That page became hold-out 2
  (`pisos_detail_bare_rows`).
- 13:11 — the forge resumed the same session with `--seed-failure a6d814b`:
  attempt 0 verdict `fail`/pytest with 4 failing tests and the ValidationError
  traceback, sent to Devin with the instruction to open a new PR.
- 13:12:57 — PR https://github.com/espetro/chezy/pull/71 (+13/-9, a typed
  `_feature_text` helper) verified: 17 passed across all three hold-outs.
  Merged 13:13:01. Time from feedback to verified fix: under 2 minutes.

`acus_consumed` reported 0 throughout; the API field seems to lag.

### Run log (`scripts/devin-forge/runs/20260920-1304.jsonl`, verbatim)

```jsonl
{"event":"session_created","runId":"20260920-1304","sessionId":"348990fec7134544a9519a8dc18d6c7a","url":"https://app.devin.ai/sessions/348990fec7134544a9519a8dc18d6c7a","ts":"2026-09-20T11:04:06.473Z"}
{"event":"verdict","attempt":1,"kind":"pass","sha":"fb419155e575f84f1a343968d2d83568cd511d8b","prUrl":"https://github.com/espetro/chezy/pull/70","acus_consumed":0,"ts":"2026-09-20T11:07:43.138Z"}
{"event":"merged","prUrl":"https://github.com/espetro/chezy/pull/70","mergeStatus":0,"ts":"2026-09-20T11:07:46.577Z"}
{"event":"session_resumed","runId":"20260920-1304","sessionId":"348990fec7134544a9519a8dc18d6c7a","url":"https://app.devin.ai/sessions/348990fec7134544a9519a8dc18d6c7a","ts":"2026-09-20T11:11:09.748Z"}
{"event":"verdict","attempt":0,"kind":"fail","gate":"pytest","failingTests":["apps/scraper/tests/test_pisos_detail_holdout2.py::test_bare_rows_do_not_break_validation","apps/scraper/tests/test_pisos_detail_holdout2.py::test_bare_rows_location_publisher_media_description","apps/scraper/tests/test_pisos_detail_holdout2.py::test_bare_rows_characteristics","apps/scraper/tests/test_pisos_detail_holdout2.py::test_bare_rows_energy_in_progress_has_no_labels"],"sha":"a6d814bdd6ca02246da49626f7a0eac47a5021f1","seed":true,"ts":"2026-09-20T11:11:12.707Z"}
{"event":"verdict","attempt":1,"kind":"pass","sha":"791d882610561d7552a10412ab6ee8f7388bf247","prUrl":"https://github.com/espetro/chezy/pull/71","acus_consumed":0,"ts":"2026-09-20T11:12:57.820Z"}
{"event":"merged","prUrl":"https://github.com/espetro/chezy/pull/71","mergeStatus":0,"ts":"2026-09-20T11:13:01.319Z"}
```

## What the judges asked vs what we have

| Ask | Evidence |
| --- | --- |
| API-driven sessions | Yes: create/poll/message/resume via v3 REST, session URLs above. |
| Non-human verifier | Yes: pytest + pydantic + ruff + basedpyright, plus hidden hold-out pages Devin never saw and a path allowlist that refuses out-of-scope diffs. |
| Failure fed back and retried | Yes, exercised for real in run 2: the first merged output crashed on a live page it had not seen, the failure was fed back through the API into the same session (`--seed-failure`), the second output was verified and merged by the verifier (PR #71). No human edit to the code. |

## Follow-ups

- All hold-out files promoted to `apps/scraper/tests/` as regression tests
  (`test(scraper): promote the pisos.com sale hold-out to a regression test`,
  `test(scraper): promote the pisos.com detail hold-outs to regression tests`).
- Next portal (yaencontre, enalquiler) reuses the same loop; nothing in
  `verify.ts` is pisos-specific beyond the task table entries.
