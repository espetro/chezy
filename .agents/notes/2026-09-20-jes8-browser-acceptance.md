# 2026-09-20 — JES-8 browser acceptance (PR #40)

## What surprised

1. **Untracked test files break the pre-push gate.** `mise run validate` lints and
   format-checks the whole tree, not just tracked files. A throwaway Playwright spec left
   under `apps/web/tests/` (with `null` fixture literals) fails `unicorn/no-null` and oxfmt
   and therefore blocks `git push`. Keep local-only QA harnesses outside the worktree, or
   delete them before pushing.
2. **Isolated QA needs its own database, not its own pg0.** pg0 is user-global; a second
   database (`CREATE DATABASE jes8_qa`) on the shared :5432 instance plus a rewritten
   `apps/web/.env.local` (`POSTGRES_URL`, `APP_BASE_URL`, `PORT=3002`, mock viewing/calendar,
   no provider keys) gives a clean environment without touching other worktrees' data.
3. **Ranking assertions need synthetic ties.** The seeded dataset already ranks outdoor
   listings first, so a `missing_balcony` rerank is invisible on it. Eight synthetic
   listings in a private neighborhood, identical except for price (tie-break) and
   balcony/terrace amenities, make the soft boost observable: `01..08` became
   `05 06 07 08 02 03 04` after rejecting `01`. Exactly eight rows also keeps the
   inventory relaxation ladder quiet, which proves feedback does not trigger relaxation.
4. **Timing-dependent hydration warning from `FlowReveal`** (JES-10, #39) on
   `/explore/[id]`: `useReducedMotion()` is `null` on the server and `false` on the
   client, so the initial `y` differs (`transform: none` vs `translateY(8px)`). Seen once
   in the dev log, not reproduced on demand. Not fixed here; belongs to #39.
5. **Two empty-state messages** when every candidate is rejected: the carousel's
   "No candidates match these filters yet." and the feed's "No homes remain with these
   filters and rejections." both render. Functional, but a copy/ownership follow-up.
