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

## What the judges asked vs what we have

| Ask | Evidence |
| --- | --- |
| API-driven sessions | Yes: create/poll/message via v3 REST, session URL above. |
| Non-human verifier | Yes: pytest + pydantic + ruff + basedpyright, plus a hidden hold-out page Devin never saw and a path allowlist that refuses out-of-scope diffs. |
| Failure fed back and retried | Loop implemented and proven by dry run (`fail`/pytest, 8 tests). Devin passed on attempt 1, so no real retry was captured; the retry path is exercised but not yet demonstrated against a live session. |

## Follow-ups

- Hold-out files promoted to `apps/scraper/tests/` as regression tests in
  `test(scraper): promote the pisos.com sale hold-out to a regression test`.
- Next portal (yaencontre, enalquiler) would exercise the retry loop for real;
  nothing in `verify.ts` is pisos-specific beyond file names.
