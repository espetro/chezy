# 2026-09-20 JES-14 integration

- `origin/main` absorbed PRs #35 to #40 while this ticket was in flight, so the integration merges prepared here (#39 with four clerical conflicts, #40 clean) became redundant and were dropped; the branch was rebuilt on `b13ab57`. PR #44 added a `stack` video segment at the same time; the `booked` -> `handoff` rename was replayed on top of it.
- PR #32's last four commits were left out on purpose: `e946ed4` reintroduces book/save
  actions on candidate cards, which contradicts the no-booking language JES-11 enforces.
- The video's `booked` checkpoint was replaced by `handoff`; `durations.json` keeps the
  old numeric value under the new key until `video:tts` runs, and `video:check` does not
  compare durations against copy, so a stale file passes silently.
- `lib/ai/models.test.ts` is a mock helper the vitest glob picks up; standalone
  `test:unit` reports "No test suite found" for it. Predates this branch.
