# Devin adapter forge: pisos.com (Cognition track evidence)

Date: 2026-09-20, planned 11:55 CEST. Submission window ~13:00-14:00, async judging
14:00-16:00. Track brief: `docs/hackbarna.md` lines 375-435. Evidence status:
`.agents/notes/2026-09-20-hackbarna-tracks.md`.

## Why this domain

Chezy's supply side is portal adapters (`apps/scraper/src/chezy_scraper/adapters/*`).
Portals change markup and new portals appear; every one costs an engineer an afternoon
of selector archaeology. That is software with a feedback loop: a captured page is the
input, a pydantic contract plus golden assertions is the standard, `pytest` is the
judge. The artifact is user-visible: listings from a new portal show up in `/explore`.

Mapping to the judging criteria:

| Criterion | How the forge answers it |
| --- | --- |
| Autonomy | Trigger is a captured HTML page + golden JSON, not chat. The layer creates the session, polls, verifies, re-dispatches, merges. No human in the loop between `mise run forge:pisos` and the merged PR. |
| Guardrails | Verdict comes from `pytest` + `pydantic` + `ruff` + `pyright`. A hold-out page Devin never sees catches overfitting. Path allowlist refuses diffs that touch anything outside the adapter surface. |
| Product | pisos.com adapter, wired into `uv run scraper scrape --platform pisos`, listings loaded into pg0 and visible on `/explore`. |
| Orchestration | Hold-out is an adversarial check. Feedback message carries the failing assertions verbatim. Stretch: fan out `normal` + `lite` modes and take the first that passes. |

Pisos.com was verified fetchable at 11:50 with a browser UA: rent page 1 (31 cards),
rent page 2 (30), sale page 1 (33). yaencontre returns 403, enalquiler 404. Cards carry
an `ld+json` `SingleFamilyResidence` block plus HTML `ad-preview__price`,
`ad-preview__char` (rooms, baths, m2, floor) and `data-lnk-href="/alquilar/..."`
(sale uses `/comprar/...`). Price on the sale page is a total, not monthly.

## Step 0: prerequisites (user, ~10 min)

1. Mint a PAT: app.devin.ai -> Settings -> Devin API -> PATs tab. Put it in root
   `.env` as `DEVIN_API_KEY=cog_...` (gitignored; never in `.env.example` with a value).
2. `DEVIN_ORG_ID`: already in `~/.config/devin/config.json` under `devin.org_id`.
   Copy into root `.env` as `DEVIN_ORG_ID=org-...`.
3. Install the Devin GitHub app on `espetro/chezy` (Settings -> Integrations -> GitHub)
   so sessions can push a branch and open a PR. Repo is public, so cloning works
   regardless; only the PR needs the app. The structured output schema also carries
   `branch` and the changed file list, so if the app is not installed the layer falls
   back to fetching the branch by name (still needs push access) and the run is not lost.
4. Sanity call before writing any code:
   `curl -s -H "Authorization: Bearer $DEVIN_API_KEY" https://api.devin.ai/v3/organizations/$DEVIN_ORG_ID/sessions | jq '.items | length'`

## Architecture

```
scripts/devin-forge/
  forge.ts            entrypoint: `tsx scripts/devin-forge/forge.ts pisos`
  devin.ts            thin v3 client (createSession, getSession, sendMessage), valibot-parsed
  verify.ts           checkout PR head into a scratch worktree, run the gates, return a Verdict
  prompt.ts           builds the session prompt from the spec below
  runs/               gitignored JSONL: one line per attempt (session id, verdict, failing tests)
apps/scraper/tests/fixtures/pisos_rent.html        given to Devin (committed before the run)
apps/scraper/tests/fixtures/pisos_rent.golden.json  given to Devin (committed before the run)
apps/scraper/tests/test_pisos.py                    given to Devin: the standard it must meet
/tmp/chezy-forge/holdout/pisos_sale.html            NOT committed until the run passes
/tmp/chezy-forge/holdout/pisos_sale.golden.json     same
/tmp/chezy-forge/holdout/test_pisos_holdout.py      same; injected into the scratch worktree
mise.toml: [tasks."forge:pisos"] -> tsx scripts/devin-forge/forge.ts pisos
```

Language: TypeScript under `scripts/` (repo convention, `tsx` + `valibot` already in
root `package.json`). `process.env` is read once through the `packages/config` Valibot
parser, per the repo ban. Session secrets: none needed; the repo is public and the
verifier runs on our machine, not Devin's.

Worktrees for verification go to `$HOME/.worktrees/chezy-forge/attempt-N` (global rule).

### The standard (authored by us, correctness-critical, not delegated)

`test_pisos.py` mirrors `test_milanuncios.py`:

- `search_url("rent", 1)` ends with `/alquiler/pisos-barcelona_capital/`;
  `search_url("sale", 3)` ends with `/venta/pisos-barcelona_capital/3/`.
- `parse_list(RENT_HTML, operation="rent", scraped_at=NOW)` yields 31 listings, every
  one validates as `Listing` with `platform == "pisos"`, `operation == "rent"`,
  `url` starting `https://www.pisos.com/alquilar/`, `price_period == "month"`.
- Three golden listings (first, middle, last card) match `pisos_rent.golden.json` on
  `platform_id`, `url`, `price_eur`, `rooms`, `bathrooms`, `built_m2`, `municipality`,
  `title`. Golden values are read off the captured HTML by us, by hand, before the run.
- `source_raw` is non-empty and `raw_features` keeps the floor string.

`test_pisos_holdout.py` (never shown to Devin):

- `parse_list(SALE_HTML, operation="sale", ...)` yields 33 listings, all `operation ==
  "sale"`, `url` starting `https://www.pisos.com/comprar/`, `price_period == "total"`,
  `price_eur > 50_000` for every card with a price.
- Three golden sale listings from `pisos_sale.golden.json`.

This is where the first attempt is expected to fail honestly: the rent fixture gives no
reason to handle `/comprar/` or a total price. If it passes first time, the run is still
valid evidence; the retry demonstration then comes from the second trap below.

Second trap, only if needed: `pisos_rent.html` page 2 has a card with no numeric price
("A consultar" style) if one exists in the capture; otherwise skip. Do not fabricate
fixtures.

### Session spec (prompt.ts)

Prompt content, in this order:

1. Repo: `https://github.com/espetro/chezy`, branch off `main`, work in `apps/scraper`.
   Toolchain via `mise trust && mise install && uv sync --all-packages` (from
   `AGENTS.md`).
2. Task: add `chezy_scraper/adapters/pisos.py` implementing the `Adapter` protocol in
   `adapters/base.py`; extend `Platform` in `models.py` and the mirrored Literal in
   `sinks/postgres.py` and `packages/contract` if pyright demands it; register in
   `__main__.py` `_ADAPTERS` and `_BUNDLE_PLATFORMS`.
3. The standard: `uv run pytest apps/scraper/tests/test_pisos.py` must pass, plus
   `uv run ruff check apps/scraper`, `uv run ruff format --check apps/scraper`,
   `uv run pyright apps/scraper`. Read `apps/scraper/AGENTS.md` for polite HTTP rules.
4. Constraints: do not edit the fixture or the test; do not special-case
   `platform_id`s from the fixture; parse generally (the adapter will run against live
   pages of both operations). Only touch the paths listed in the allowlist.
5. Deliverable: push branch `feat/chezy-forge/pisos-adapter-<runid>`, open a PR
   titled `feat(scraper): pisos.com adapter (forge run <runid>)`, then call
   `provide_structured_output` with the schema below.

Structured output schema (Draft 7):

```json
{ "type": "object", "required": ["branch", "pr_url", "changed_files", "tests_passed"],
  "properties": {
    "branch": {"type": "string"},
    "pr_url": {"type": "string"},
    "changed_files": {"type": "array", "items": {"type": "string"}},
    "tests_passed": {"type": "boolean"},
    "notes": {"type": "string"} } }
```

Create request: `{ prompt, repos: ["espetro/chezy"], title: "forge:pisos <runid>",
tags: ["forge", "pisos", runid], structured_output_schema, structured_output_required:
true, max_acu_limit: 8, resumable: true, devin_mode: "normal" }`.

### Verifier (verify.ts), one attempt

1. Wait for `status_detail in {finished, waiting_for_user}` or `status in {exit, error,
   suspended}` (poll every 15 s, hard cap 25 min per attempt).
2. Read `pull_requests[0].url` (fallback `structured_output.pr_url`), resolve the head
   SHA with `gh pr view --json headRefOid`.
3. `git fetch origin <branch>`; `git worktree add ~/.worktrees/chezy-forge/attempt-N <sha>`.
4. Guardrail A, path allowlist on `git diff --name-only main...<sha>`:
   `apps/scraper/src/chezy_scraper/adapters/pisos.py`,
   `apps/scraper/src/chezy_scraper/models.py`,
   `apps/scraper/src/chezy_scraper/__main__.py`,
   `apps/scraper/src/chezy_scraper/sinks/postgres.py`,
   `packages/contract/src/**`, `apps/scraper/tests/test_pisos.py` must be byte-identical
   to `main`. Anything else -> verdict `refused`, message lists the offending paths.
5. Copy the hold-out files into the worktree (`tests/fixtures/pisos_sale.html`,
   `tests/fixtures/pisos_sale.golden.json`, `tests/test_pisos_holdout.py`).
6. Gates, in order, capturing stdout/stderr:
   `uv sync --all-packages`, `uv run pytest apps/scraper/tests/test_pisos.py
   apps/scraper/tests/test_pisos_holdout.py -q`, `uv run ruff check apps/scraper`,
   `uv run ruff format --check apps/scraper`, `uv run pyright apps/scraper`.
7. Verdict: `pass` | `fail(gate, output)` | `refused(paths)`. Append to `runs/<runid>.jsonl`.

### Loop (forge.ts)

```
attempt = 1; session = createSession(spec)
while attempt <= 3:
  verdict = verify(session, attempt)
  if pass: merge PR (`gh pr merge --squash --delete-branch`), tag session "forge:verified", break
  if refused: sendMessage("Your PR touches <paths>. Revert those files; the allowlist is ..."), attempt++
  if fail: sendMessage("Verifier rejected attempt N. Gate: pytest. Output:\n<last 60 lines>\n
            Fix the adapter so both operations parse; do not edit tests or fixtures."), attempt++
if attempt > 3: tag "forge:escalated", print the runs file, exit 1 (human takes over: this is the refusal path)
```

The failing pytest output goes to Devin verbatim; the hold-out test names reveal what
broke (`test_sale_urls_use_comprar`, `test_sale_price_is_total`) without shipping the
fixture. The hold-out stays hidden across attempts.

### After a green run

1. Commit the hold-out fixture, golden and test into `apps/scraper/tests/` on `main`
   (they are now regression tests). Commit `scripts/devin-forge/`, the mise task, and
   `runs/<runid>.jsonl` promoted to `.agents/notes/2026-09-20-devin-forge-run.md`
   (session URLs, per-attempt verdicts, ACUs consumed, the failing assertion text).
2. `uv run scraper scrape --platform pisos --operation rent --tier small`, then the
   existing load path into pg0, then screenshot `/explore` showing a pisos.com card.
3. Update `PRD.md` tracks table row (Cognition) and
   `.agents/notes/2026-09-20-hackbarna-tracks.md`.
4. Add `.forge/` and `scripts/devin-forge/runs/` to `.gitignore`.

## Commits (atomic, conventional)

1. `test(scraper): pisos.com rent fixture, golden values and adapter contract test`
2. `feat(forge): Devin v3 client and verifier loop for portal adapters`
3. `chore(mise): forge:pisos task`
4. (Devin's PR, squash-merged by the layer)
5. `test(scraper): pisos.com sale hold-out promoted to regression test`
6. `docs: record the forge run and update the Cognition track row`

## Timeline (wall clock, from 12:05)

| Slot | Work | Who |
| --- | --- | --- |
| 12:05-12:20 | Step 0 (PAT, GitHub app) in parallel with fixture capture + golden JSON + test_pisos.py | user / me |
| 12:20-12:50 | forge.ts, devin.ts, verify.ts, prompt.ts, mise task; dry-run verify.ts against a hand-made branch to prove the gates run | sidekick, I review |
| 12:50 | Commit 1-3, kick off `mise run forge:pisos` | me |
| 12:50-13:40 | Devin attempts (10-20 min each, 2-3 attempts) | Devin, layer |
| 13:40-14:00 | Green run: merge, hold-out promotion, scrape, screenshot, notes, PRD row | sidekick, me |

If the first attempt has not returned by 13:20, submit the track with the run log as-is
(sessions created via API, verifier code, attempt 1 verdict) and let it finish during
async judging; the log file is appended live.

## Risks

- Devin environment bootstrap (mise + uv) may eat 10 min per attempt. Mitigation:
  `resumable: true` so retries reuse the VM; prompt names the exact bootstrap commands.
- Hold-out passes first time: still valid evidence; the run log shows a non-model
  verdict. The retry story then needs the second trap or a deliberate second portal.
- Devin GitHub app not installed: PR creation fails; structured output still names the
  branch, but pushing needs write access. Step 0.3 is therefore blocking for the PR
  path. Fallback: the layer accepts `changed_files` contents via structured output
  (schema addition `files: [{path, content}]`) and writes them into the worktree.
- pisos.com blocks the live scrape at demo time: the fixture-based tests still pass and
  the merged adapter is the artifact; the `/explore` screenshot uses the bundled tier.
- `Platform` Literal is mirrored in `packages/contract` (Valibot) and `sinks/postgres.py`;
  pyright will surface the mismatch. The allowlist includes those paths for that reason.
- API token scope: a PAT has your user's permissions, which cover `UseDevinSessions`.
  Rate limits (429) are handled with a 30 s backoff in `devin.ts`.

## Out of scope today

- Fan-out across modes (`normal` + `lite`) and learning across runs via knowledge notes.
  Mention as next step in the submission text, do not build.
- A generic `forge <portal>` CLI for arbitrary portals; today it is pisos.com only, but
  nothing in `verify.ts` is portal-specific beyond the file names.
