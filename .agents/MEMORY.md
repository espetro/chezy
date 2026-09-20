# Chezy memory

> Project-scoped scratchpad. Per-session notes land in `.agents/notes/YYYY-MM-DD.md`; the
> durable cross-session learnings live here. Read this on session start; append a dated
> note when something non-obvious comes up.

## Stack snapshot (day 0)

- Frontend: Next.js 16 App Router + React 19 + AI SDK 7 + `@ai-sdk/openai-compatible`
  pointed at Nebius AI Studio (verbatim `vercel/chatbot` import — zod, `@/*`, `useEffect`,
  `process.env`, NextAuth guest auth all still in use there; chezy bans apply to
  `packages/*` + `scripts/` only).
- DB: pg0 (embedded Postgres 18 + pgvector), single binary, no Docker.
- Scraper: uv-managed Python CLI, httpx + parsel + pydantic.
- Toolchain: mise (node 24, pnpm 12, python 3.12, uv latest, pg0 latest, ffmpeg latest).
- Lint/format: oxlint 1.77 + oxlint-tsgolint 7 + oxfmt 0.60.
- Hooks: lefthook v2, pre-push = `mise run validate`.

## Non-obvious project decisions

- **vercel/chatbot import**: `apps/web` is a verbatim import of `vercel/chatbot` (PR #2);
  reference copy at `apps/web/vendor/chatbot-template/` (excluded from tsconfig). Auth is
  NOT stripped — `app/(auth)` NextAuth 5 guest credentials provider is required
  (`/api/chat` → `unauthorized:chat` without the session cookie). Neon → pg0 and
  `@ai-sdk/gateway` → `@ai-sdk/openai-compatible` are the only deliberate swaps so far.
- **Banned-list caveat**: the chezy bans (zod, Biome, `useEffect`, `@/*`, direct
  `process.env`) are real but `apps/web/**` sits in `.oxlintrc.json` `ignorePatterns`, so
  they apply to `packages/*` and `scripts/` only. Re-aligning `apps/web` is the
  manual-review checklist in `apps/web/AGENTS.md`.
- **LLM provider**: `@ai-sdk/openai-compatible` via env `OPENAI_COMPATIBLE_BASE_URL` /
  `OPENAI_COMPATIBLE_API_KEY` / `CHEZY_MODEL_ID` / `CHEZY_TITLE_MODEL_ID`. Provider is
  Nebius AI Studio (`https://api.studio.nebius.com/v1`, model
  `deepseek-ai/DeepSeek-V4.1-Flash`, title model `Qwen/Qwen3-30B-A3B-Instruct-2507`);
  key = `NEBIUS_API_KEY` in `apps/web/.env.local` + GH secrets/variables. Code default is
  local bifrost `http://localhost:8317/v1`. Model list fetched from `{base}/models`.
- **Zod banned**: `.oxlintrc.json` enforces `no-restricted-imports` banning the `zod`
  package (outside `apps/web`). Use `valibot` instead.
- **Biome banned**: `.oxlintrc.json` enforces `no-restricted-imports` banning
  `@biomejs/*`. `apps/web` itself ships no `biome.jsonc` (only the vendor copy under
  `vendor/chatbot-template/` has one) and is linted by nothing today — oxlint ignores it.
  Use oxlint + oxfmt.
- **`useEffect` banned** (outside `apps/web`): see `.agents/skills/no-use-effect/SKILL.md`.
  Use the five replacement patterns or `useMountEffect` from
  `@chezy/ui/hooks/useMountEffect`.
- **pg0 is local-only**: `mise run db:start` shells out to the `pg0` CLI. There's no
  Docker compose, no cloud Postgres. Data lives at `~/.pg0/` (user-global, not
  per-worktree — `pg0 start` is idempotent and resumes the same data dir).
- **No `apps/api`**: the user spec calls for an empty Python CLI scraper on day 0;
  `apps/api` is not scaffolded. Add it later when the AI orchestration layer needs to be
  Python-side.
- **`@/*` alias is forbidden** in chezy code: the upstream template uses `@/*` aliases
  (and still does inside `apps/web`). We use `~/*` (tsconfig paths) and ban `@/*` via
  `no-restricted-imports` patterns.
- **DB env var is `POSTGRES_URL`** (not `DATABASE_URL`) — see `apps/web/drizzle.config.ts`
  and `apps/web/lib/db/`.
- **Demo coverage is Barcelona city only** — listings dataset is Barcelona-only, so
  onboarding asks for neighborhoods, not cities. Governed by `COVERAGE_CITY` in
  `apps/web/lib/constants.ts`; referenced by `onboardingPrompt` in `lib/ai/prompts.ts`.
- **UI language is English (decided 2026-09-19)** — but several Spanish surfaces remain,
  explicitly un-fixed for now: `lib/match.ts` reasons and `lib/feed.ts`'s relaxation note
  are Spanish strings rendered inside the English cards; the chat system prompts in
  `lib/ai/prompts.ts` speak Spanish; `screens/radar.md` still says "keep the Spanish
  locale". The SLNG voice agent is exempt — it calls Spanish agencies and stays Spanish.
  Resolution path: translate `lib/match.ts`/`lib/feed.ts` and the chat prompts in a later
  pass; voice agent exempt.

- **Devin API for JES-12 (2026-09-20)**: `ADAPTATION_MODE=mock|devin` (default mock) picks
  the provider for the rejection-triggered comparison panel. The account key is a v1
  `apk_user_` key: v3 returns 403, so `lib/devin/client.ts` speaks v1. Mock runs are
  labelled "Simulated" in the UI and never count as the sponsor proof. See
  `docs/jes-12-adaptive-panel.md`.

## Disk budget (multi-worktree)

Expected per-worktree footprint on macOS APFS:

| Component | Size | Shared? |
| --- | --- | --- |
| `node_modules/.pnpm` symlink tree | ~150–400 MB | no (per-worktree, but global store is shared) |
| `.venv` | ~100–300 MB | no (per-worktree; file-level dedup into `~/.cache/uv`) |
| `~/.cache/uv` | shared | yes |
| `~/Library/pnpm/store` | shared | yes |

## Workflows (chezy-specific)

- **New worktree**: `mise run wt:init` — copies `.env`, runs `pnpm install` +
  `uv sync --all-packages`, then `db:start` (see `scripts/worktree-init.sh`).

## `/` product surface — the flow (formerly `/flow`, promoted 2026-09-19)

The product is the flow, rooted at `/` (`apps/web/app/(flow)/**`, `components/flow/**`,
`lib/flow/**`): landing → `/onboarding` → `/explore` → `/explore/[id]`; chat lives at
`/chat`. (2026-09-20: `/chat` page dropped, API routes + `components/chat/**` kept for
reuse.) `/flow/*` URLs 307-redirect to the root equivalents via `next.config.ts`. All
routes are session-gated by `proxy.ts` like everything else (guest auto-login). Its own
design tokens (obsidian/ember, DM Sans) live in a clearly-delimited block at the bottom
of `apps/web/app/globals.css`; none of them redefine the chat's shadcn tokens. See
`.agents/docs/screens/flow-*.md` for per-screen specs and
`.agents/plans/2026-09-19-port-to-main.md` for the port rationale.

- **Real data, not mocks (2026-09-19)**: onboarding PUTs `SearchProfile` via
  `/api/profile` (which also mirrors a coarse copy into `User.profile` for the chat);
  `/explore` renders `buildFeed(profile)` ranked by `scoreListing`; detail pages load
  `getListingRowById` + `scoreListing`. Mapping lives in `lib/flow/adapters.ts`
  (`toSearchProfileInput`/`fromSearchProfile`/`toFlowListing`). The old mock listings,
  mock matcher and simulated-call helper are deleted.
- **Elevation rule ≠ chat rule**: the flow's surfaces are `bg-snow shadow-sm` with no
  border and controls are recessed `bg-paper` (from the Stitch design, 2026-09-19). The
  chat app keeps hairline borders. Don't "fix" one to match the other.
- **Token naming caveat**: Stitch's `secondary`/`secondary-fixed` were added as
  `ember-deep`/`ember-soft` because `--color-secondary` is a live shadcn token in the chat.
  Any future Stitch export must be checked for name collisions the same way (`grep` the
  `@theme inline` block in `apps/web/app/globals.css`) before adding tokens.

- **Auto-call gate (2026-09-19)**: `AgentCallGate` calls the real `POST /api/viewing`
  with `{ propertyRef }` (`VIEWING_MODE` picks mock/slng/vonage). At
  `matchScore >= AUTO_CALL_MATCH_THRESHOLD` (95, `lib/flow/constants.ts`) it auto-dials
  on mount — guarded by `localStorage["chezy:autocall:<listingId>"]` so a real phone
  rings at most once per listing per browser. Below 95% there's a manual "Call the
  agency now" override; failures show `detail` + "Try again". This overrides the
  onboarding autonomy tier entirely, by design. See `.agents/docs/screens/flow-match.md`.

## Key references

- `.agents/skills/no-use-effect/` — the no-`useEffect` rule + `useMountEffect` escape hatch.
- `.agents/docs/architecture.md` (→ `ARCHITECTURE.md`) — module graph + boundary rules.
- `.agents/docs/design.md` (→ `DESIGN.md`) — visual + UX constraints.
- `.agents/docs/screens/radar.md` — concierge/radar demo screen spec (UI dropped in PR #6).
- `.agents/plans/` — date-stamped plans for non-trivial work.

## Things to revisit

- Once `apps/web` has a real feature, add a `mise run dev:fake` task and Playwright e2e
  under `tests/e2e/` (markdown checkpoints, dual-server: `apps/web` + `pg0 start`).
- Decide on `apps/api` later — likely FastAPI + Pydantic AI + AG-UI, exposing an
  `assistant-ui` runtime. Not on the day-0 critical path.
- Wire CI: no `.github/workflows/` exists yet — `mise run validate` only runs via the
  lefthook pre-push hook. `NEBIUS_API_KEY`/`OPENAI_COMPATIBLE_API_KEY` secrets and
  `OPENAI_COMPATIBLE_BASE_URL`/`CHEZY_MODEL_ID` repo variables are already provisioned.
- `apps/web` re-alignment checklist (see `apps/web/AGENTS.md`): `@/*`→`~/*`, zod→valibot,
  next-auth keep/remove decision, `process.env`→`lib/env.ts`, `useEffect`→patterns, then
  drop `apps/web/**` from `.oxlintrc.json` ignorePatterns.
- Norma compliance pass (2026-09-19): fixes, accepted register and defence in
  `.agents/notes/2026-09-19-norma-compliance.md`. `next build` already fails on `main` at
  `lib/vision/extract.ts` (`import.meta.dirname`); `lib/errors.ts` must not import the
  `@chezy/observability` index (client bundle).
