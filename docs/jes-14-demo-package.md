# JES-14 integrated three-minute demo package

Everything a presenter needs to rehearse and record the 180-second chezy demo from one
revision, with an honest label on what is mock, real, recorded or time-compressed.

## Exact revision

| What                  | Revision                                                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product code demoed   | `657ad43` on `feat/jes-14/demo-package` (= `origin/main` `a28e885` + PR #39 `fff3db8` + PR #40 `072a1ba`)                                                                                                                                                                            |
| Base `main`           | `a28e885` (merge of PR #38), which already contains PRs #35, #36, #37, #38, #41, #42, #43                                                                                                                                                                                            |
| Video pipeline        | the `feat(video)` commit on this branch (`apps/video`)                                                                                                                                                                                                                               |
| Deliberately excluded | PR #32's remaining four commits (`de03b74`, `e946ed4`, `ad44927`, `eaacd8b`): `e946ed4` adds book/save/discard actions to candidate cards, which contradicts the truthful no-booking language of JES-11 and the dismissal seam JES-8/JES-10 replaced it with. Escalated, not merged. |
| JES-12 and JES-13     | never implemented (blocked on JES-8 during the parallel run). There is no Devin candidate, validator/retry or accepted panel in the product; the demo does not claim one.                                                                                                            |

Verified on this branch with pg0 running: `mise run validate` (typecheck, lint, 265 web
tests, format), `pnpm --filter @chezy/web build` (migrations applied, 31 pages).
`lib/ai/models.test.ts` reports "No test suite found" when run standalone; it is a mock
helper picked up by the vitest glob and predates this branch.

## What is connected (checked in code on `657ad43`)

- Reset clears per-user state and leaves other users alone: `apps/web/lib/demo/reset.ts`
  runs `demoUserCleanups = [clearUserFeedback]` inside one transaction;
  `apps/web/lib/feedback.ts` deletes `listingFeedback` filtered by the authenticated
  `userId`. Both profile stores are cleared by the same transaction (JES-5).
- Rejection -> rerank: `CandidateCarousel` mounts `RejectionControl` per card ->
  `use-listing-feedback.ts` POSTs `/api/feedback` -> `recordFeedback`/`undoFeedback` ->
  `feedbackBoost` in `lib/feedback-ranking.ts` feeds the sort in `lib/match.ts`;
  `/explore` and `/explore/[id]` read `listActiveFeedback` (JES-8).
- Grounded explanation: `MatchDetail` -> `InsightPanel` -> `MatchExplanation` fetches
  `/api/explain` -> `explainMatch` (JES-7, mounted by JES-10). Unknowns render as
  unknown; the deterministic fallback renders when no provider key is configured.
- Truthful viewing dispatch: `AgentCallGate` renders `dispatching`, `simulated`,
  `dispatched`, `failed`; automatic requests always simulate; live requires the opt-in
  checkbox plus `VIEWING_LIVE_ENABLED=true` and `DEMO_AGENCY_PHONE` (JES-11).
- Not connected, by design of this run: Devin candidate -> validator/retry -> accepted
  panel (JES-12/13). `grep -ri devin apps/web/lib apps/web/components` returns nothing.

## 180-second storyboard

Timing is the recording target for the live walkthrough. The Remotion piece uses the same
five checkpoints with narration-driven timing (see `apps/video/CAPTURE.md`).

| #   | Time         | Screen (route)                | What the audience sees                                                                                                                                                                                                                                                                        | Label                                                            |
| --- | ------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 0   | 0:00 to 0:12 | `/` landing                   | Title, two lines: "Listings lie." "Speed decides." VO cites the 36% under-24-hours figure (idealista Barcelona Q2 2026, cited in `PRD.md` and `README.md`).                                                                                                                                   | Real product surface                                             |
| 1   | 0:12 to 0:35 | `/onboarding`                 | "Reset and load demo" fills the JES-5 persona (Norrsken / Poblenou 22@, 25 min commute, 1,500 to 2,500 EUR, 2 rooms, 60 m2, balcony or terrace). Profile persists across chats.                                                                                                               | Real, deterministic fixture persona                              |
| 2   | 0:35 to 1:05 | `/explore`                    | Carousel of real Barcelona fixture listings ranked for the persona; the three demo candidates are `fotocasa:190866104`, `fotocasa:190451552`, `fotocasa:189698965`. Presenter rejects one card with reason "no outdoor space"; the remaining cards visibly rerank; Undo restores.             | Real data, real ranking, mock provider not involved              |
| 3   | 1:05 to 1:40 | `/explore/[id]`               | Grounded explanation panel: sourced facts (price, m2, rooms, listed amenities), explicit unknowns, unchanged match score. If no Nebius key is configured the panel shows the deterministic fallback and says so.                                                                              | Real listing facts; LLM wording is live only with a provider key |
| 4   | 1:40 to 2:35 | `/explore/[id]` viewing panel | "Simulate viewing call" -> "Requesting call" -> "Simulated: No phone call or calendar booking was made." Presenter shows the opt-in checkbox and explains a live dispatch would show "Call requested, awaiting agency confirmation" plus the request-to-dispatch timing, never a booked slot. | Mock by default; live path exists, unverified live               |
| 5   | 2:35 to 3:00 | `/explore/[id]`               | Truthful state stays on screen; presenter returns to `/onboarding` and hits "Reset to empty onboarding" to prove repeatability. Close on the tagline.                                                                                                                                         | Real                                                             |

Time compression: none is needed for the live walkthrough. In the Remotion piece, the
call scene is a mock storyboard of the simulated call and is tagged MOCK on screen
(`showMockTags: true`); nothing in it is a recording of a real agency call.

## Reproducible recording checklist

1. `mise trust && mise install && mise exec -- pnpm install --frozen-lockfile`.
2. `apps/web/.env.local`: `POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres`,
   `AUTH_SECRET=<any random string>`, `VIEWING_MODE=mock`, `CALENDAR_MODE=mock`, `IS_DEMO=1`.
   Leave `VIEWING_LIVE_ENABLED` unset (defaults to `false`). `OPENAI_COMPATIBLE_API_KEY`
   is optional: without it the explanation panel uses the deterministic fallback.
3. `mise run demo:setup` (starts pg0, migrates, seeds fixture listings), then
   `mise run demo:check` (repeatable persona, candidates, rollback, isolation).
4. `mise exec -- pnpm --filter @chezy/web build && mise exec -- pnpm --filter @chezy/web start`.
   Production `next start` needs HTTPS for the secure Auth.js cookie when recorded in a
   browser; a local HTTPS proxy in front of the port is the known workaround. `pnpm dev`
   on plain `http://localhost:3000` avoids that.
5. Fresh browser profile, 1920x1080 for the video, 375px for the mobile pass. Open `/`
   once so the guest session cookie is issued.
6. Run scenes 0 to 5 in order. Before each take: `/onboarding` -> "Reset and load demo".
7. Confirm zero requests leave localhost (browser network panel filtered by domain).
8. Remotion piece: `mise run video:tts` (pocket-tts) -> `video:durations` ->
   `video:capture-doc` -> `video:srt` -> `video:check` -> `video:render`. `video:check`
   caps the total at 175 s. `video:music` is optional and macOS-only; skip it and set
   `music.file` to `undefined` in `demo.config.ts` if the bed cannot be generated.
   `src/generated/durations.json` on this branch is stale for the rewritten copy and is
   refreshed by step 8.
9. Do not commit WAVs, MP4s, screenshots or logs (`public/audio`, `public/clips`, `out/`
   are gitignored).

## Technical brief

- Stack: Next.js 16 App Router, React 19, AI SDK 7 with `@ai-sdk/openai-compatible`
  (Nebius AI Studio, `deepseek-ai/DeepSeek-V4.1-Flash`), Drizzle over pg0 (Postgres 18 +
  pgvector), Valibot contracts, oxlint/oxfmt, mise-pinned toolchain.
- Flow: `/` -> `/onboarding` -> `/explore` -> `/explore/[id]`; APIs `/api/profile`,
  `/api/feedback`, `/api/explain`, `/api/viewing`, `/api/calendar`, `/api/demo/reset`.
- Voice: SLNG managed voice agent (unmute-authored) with Vonage telephony,
  `apps/web/lib/slng.ts`, `lib/vonage.ts`, `lib/viewing-dispatch.ts`. Dispatch is behind
  `VIEWING_MODE=live`, `VIEWING_LIVE_ENABLED=true`, explicit client opt-in and a
  configured team-owned `DEMO_AGENCY_PHONE`. Retries reuse `requestId`; receipts are
  process-local, so multi-instance idempotency is a known gap.
- Evaluation: JES-9 Galtea harness under `apps/web/scripts/galtea` (snapshot, run,
  compare) with ten frozen adversarial cases; JES-7 five-fixture evaluation
  (`scripts/evaluate-explanations.ts`).
- Video: Remotion 4 in `apps/video`, copy in `src/copy/en.json` validated by Valibot,
  audio-first timeline, pocket-tts narration, MOCK tags on storyboard scenes.

## Sponsor proof matrix

"Live proof" means a request that reached the sponsor's production API from this codebase
with a recorded result. None exists in the upstream ticket runs; the parent session's
secret listing was empty and no worker had sponsor credentials.

| Sponsor               | Where it is wired                                   | Mock / offline evidence                                                                                                                                   | Live proof                                                                                 | Status                                      |
| --------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Nebius AI Studio      | `lib/ai/providers.ts`, `/api/explain`, chat         | JES-7: 5 fixtures, 12/12 supported claims, 3 explicit unknowns, deterministic fallback; JES-9: offline snapshot of 10 cases (suite hash `57a95334...90f`) | None (no `OPENAI_COMPATIBLE_API_KEY` in any run)                                           | Code ready, live unverified                 |
| SLNG (voice agent)    | `lib/slng.ts`, `/api/viewing`                       | JES-11: Playwright 11/11 on mock/dispatched/failed states, HTTP smoke (mock 200, malformed 400, live-disabled 403)                                        | None (`SLNG_API_KEY`, `SLNG_AGENT_ID`, `DEMO_AGENCY_PHONE` absent; no real call attempted) | Code ready, live unverified                 |
| Vonage                | `lib/vonage.ts`, telephony leg of the SLNG dispatch | Same as SLNG                                                                                                                                              | None                                                                                       | Code ready, live unverified                 |
| Galtea                | `apps/web/scripts/galtea`                           | JES-9: dataset.csv + report.json, offline UUID `c0aa6cad-...` (local metadata, not a Galtea run ID)                                                       | None (no Galtea key; no dataset/version/session IDs)                                       | Harness ready, evaluation unexecuted        |
| QualityClouds (Norma) | Repo scan, `safeHttpUrl` guard                      | JES-6 dossier: historical portal 62 -> 63/100, 366 -> 344 findings (PRs #29/#31); scan IDs and scanned SHAs not supplied                                  | None for the demo revision; owner must rescan the frozen SHA                               | Historical only                             |
| Cognition (Devin)     | Not in the product (JES-12/13 unimplemented)        | Development process only                                                                                                                                  | n/a                                                                                        | Not a product integration; do not claim one |

## Acceptance status for JES-14

- Integration branch, clerical conflict resolution, validate and build: done.
- Reset isolation and the rejection -> explanation -> truthful dispatch chain: checked
  in code (see above); browser rehearsal of the integrated branch: not performed in this
  session, so the demo is not called browser-verified here. Component-level browser
  acceptance exists per ticket (JES-5, JES-8, JES-10, JES-11) on their own branches.
- Video: fake booked ending and unsupported forensic/sunlight claims rewritten; the
  36% figure is kept because it is cited. VO not regenerated here (`video:tts` needs
  pocket-tts); `durations.json` is stale until step 8 runs.
- Devin candidate -> validator/retry -> accepted panel: not connected, because JES-12
  and JES-13 were never delivered. Escalated in the handoff.
- Live sponsor proof: none. See the matrix.
