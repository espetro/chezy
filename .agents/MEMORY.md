# Chezy memory

> Project-scoped scratchpad. Per-session notes land in `.agents/notes/YYYY-MM-DD.md`; the
> durable cross-session learnings live here. Read this on session start; append a dated
> note when something non-obvious comes up.

## Stack snapshot (day 0)

- Frontend: Next.js 16 App Router + React 19 + AI SDK 7 + `@ai-sdk/gateway` (oxlint /
  oxfmt, Valibot, no auth).
- DB: pg0 (embedded Postgres 18 + pgvector), single binary, no Docker.
- Scraper: uv-managed Python CLI, httpx + parsel + pydantic.
- Toolchain: mise (node 24, pnpm 12, python 3.12, uv latest, pg0 latest, ffmpeg latest).
- Lint/format: oxlint 1.77 + oxlint-tsgolint 7 + oxfmt 0.60.
- Hooks: lefthook v2, pre-push = `mise run validate`.

## Non-obvious project decisions

- **VerceI/chatbot fork**: day-0 scaffold is `vercel/chatbot` with auth stripped, Zod →
  Valibot, Biome → oxlint/oxfmt, Neon → pg0. Plan in `.agents/plans/2026-09-19-init.md`.
- **Zod banned**: `.oxlintrc.json` enforces `no-restricted-imports` banning the `zod`
  package. Use `valibot` instead.
- **Biome banned**: `.oxlintrc.json` enforces `no-restricted-imports` banning
  `@biomejs/*`. Use oxlint + oxfmt.
- **`useEffect` banned**: see `.agents/skills/no-use-effect/SKILL.md`. Use the five
  replacement patterns or `useMountEffect` from `@chezy/ui/hooks/useMountEffect`.
- **pg0 is local-only**: `mise run db:start` shells out to the `pg0` CLI. There's no
  Docker compose, no cloud Postgres. Data lives at `~/.pg0/` (user-global, not
  per-worktree — `pg0 start` is idempotent and resumes the same data dir).
- **No `apps/api`**: the user spec calls for an empty Python CLI scraper on day 0;
  `apps/api` is not scaffolded. Add it later when the AI orchestration layer needs to be
  Python-side.
- **`@/*` alias is forbidden**: the upstream template's Biome config uses `@/*` aliases.
  We use `~/*` (tsconfig paths) and ban `@/*` via `no-restricted-imports` patterns.

## Disk budget (multi-worktree)

Expected per-worktree footprint on macOS APFS:

| Component | Size | Shared? |
| --- | --- | --- |
| `node_modules/.pnpm` symlink tree | ~150–400 MB | no (per-worktree, but global store is shared) |
| `.venv` | ~100–300 MB | no (per-worktree; file-level dedup into `~/.cache/uv`) |
| `~/.cache/uv` | shared | yes |
| `~/Library/pnpm/store` | shared | yes |

Full breakdown + commands in `.agents/docs/worktree-disk-budget.md`.

## Workflows (chezy-specific)

- **Day-0 feature**: `mise run wt:init` — bootstrap a freshly-cloned worktree
  (`pnpm install` + `uv sync --all-packages`). See `.agents/workflows/wt-init.md`.
- **Adding a new shadcn component**: `.agents/workflows/add-shadcn-component.md`.
- **Adding a new Valibot schema**: `.agents/workflows/add-valibot-schema.md`.
- **Adding a new Drizzle table**: `.agents/workflows/add-drizzle-table.md`.

## Key references

- `.agents/skills/no-use-effect/` — the no-`useEffect` rule + `useMountEffect` escape hatch.
- `.agents/docs/architecture.md` (→ `ARCHITECTURE.md`) — module graph + boundary rules.
- `.agents/docs/design.md` (→ `DESIGN.md`) — visual + UX constraints.
- `.agents/docs/worktree-disk-budget.md` — pnpm + uv disk budget on APFS.
- `.agents/plans/` — date-stamped plans for non-trivial work.

## Things to revisit

- Once `apps/web` has a real feature, add a `mise run dev:fake` task and Playwright e2e
  under `tests/e2e/` (markdown checkpoints, dual-server: `apps/web` + `pg0 start`).
- Decide on `apps/api` later — likely FastAPI + Pydantic AI + AG-UI, exposing an
  `assistant-ui` runtime. Not on the day-0 critical path.
- Hook the validate gate into GitHub Actions when the repo gets pushed.
