# 2026-09-20: chat canonical flow

Branch `feat/chezy-0/chat-canonical-flow`; plan + contract in
`.agents/plans/2026-09-20-chat-canonical-flow.md` and `.agents/docs/demo-flow.md`.
`/chat` is now the product; `(flow)` is frozen; `/` 307s to `/chat`.

Things that surprised me:

- The 13h-old `next dev` had leaked Turbopack workers to ~5 GB RSS and `.next` sat at
  1.7 GB with `turbopackFileSystemCacheForDev`. Restart before a demo, not after.
- `db:migrate` silently skips when `POSTGRES_URL` is unset: `lib/db/migrate.ts` imports
  `env` before dotenv loads `.env.local`. Export it on the command line. Worse, the dev
  DB's `drizzle.__drizzle_migrations` claimed 0003/0004/0005 applied while
  `ListingInsight`, `SearchProfile`, and the 0005 marker were missing (drift from
  out-of-band pushes). Replayed the two CREATE TABLEs by hand and inserted the missing
  journal rows. The frozen-path e2e fails on `/onboarding` with `relation
  "SearchProfile" does not exist` until the tables exist.
- `dispatchViewing` in mock mode never dials, so it no longer needs a callee. Real
  `slng`/`vonage` still require `agencyPhone` or `DEMO_AGENCY_PHONE`.
- Dataset measurement for the Jessie brief: at 1,800 EUR in Gràcia+Eixample the red
  line leaves 0 candidates. Brief moved to 2,400 EUR, Eixample+Poblenou, where 2
  seeded listings score 100%. `evals/fixtures/jessie.ts` and `demo-flow.md` must change
  together.
- MiniMax-M3 via bifrost needed the explicit prompt line "re-search in the same turn
  after recordListingFeedback, do not ask permission" or it stalls after a rejection.
- `lib/ai/models.test.ts` is a mock helper with no test suite; `vitest run` reports it
  as a failed file on main too. Pre-existing, not a regression.

Follow-ups: `evals/scorer.golden.test.ts` still asserts the old 1,800 Gràcia brief
against the new fixture (7 failures, needs a retargeted golden set); viewing route test
now asserts 502 + `detail` for a missing callee in real-call mode.

Pivot later the same morning: /chat page dropped (#49), checkpoints defined (#48), this branch rebased to backend + evals only.
