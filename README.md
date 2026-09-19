# chezy

Chat-centric AI webapp, 0→1 hackathon build. See [`AGENTS.md`](AGENTS.md) for the canonical
agent instructions (enforced gates + conventions). For longer-form background, see
[`docs/prd.md`](docs/prd.md).

## Layout

```
apps/
  web/        Next.js 16 + React 19 + AI SDK 7 fork of vercel/chatbot.
              Auth stripped, Zod → Valibot, Biome → oxlint/oxfmt, Neon → pg0.
  scraper/    Python CLI. uv workspace member. httpx + parsel + pydantic.
packages/
  ui/         Shared React primitives (useMountEffect escape hatch, shadcn wrappers).
  contract/   Wire types / domain contracts shared between apps.
  db/         Drizzle schema + Drizzle client + pg0 lifecycle helper.
  config/     Valibot env parser + config injection. Single source of truth for env reads.
scripts/
  validate.ts  TS validate gate runner.
  validate.py  Python validate gate runner.
.agents/
  skills/no-use-effect/  Five-pattern rule + useMountEffect escape hatch.
  plans/                 Plans, dated and human-reviewed before implementation.
  notes/                 Date-stamped session notes.
  docs/                  Long-form reference docs (worktree disk budget, etc).
.github/
  workflows/ci.yml       Runs `mise run validate` on every branch push.
```

## Toolchain (pinned via mise)

| Tool | Version | Source |
| --- | --- | --- |
| node | 24 | `corepack`-compatible, used by pnpm/oxlint/oxfmt |
| pnpm | 12 | Monorepo package manager; global store at `~/Library/pnpm/store` |
| python | 3.12 | uv-managed Python for `apps/scraper` |
| uv | latest | Python package manager; content-addressable cache at `~/.cache/uv` |
| pg0 | latest | Local Postgres 18 + pgvector (no Docker), used by `apps/web` Drizzle client |
| ffmpeg | latest | Implicit runtime dep of AI SDK streaming tests |

## First-time setup

```bash
mise trust
pnpm install
uv sync --all-packages
mise run db:start
mise run dev
```

The dev server starts on `http://localhost:3000` (Next.js). `pg0` listens on
`postgres://postgres:postgres@127.0.0.1:5432/postgres`; the Drizzle client reads
`DATABASE_URL` from `apps/web/.env.local`.

## Day-0 scope

Skeleton only. `apps/web` renders the upstream chatbot shell with the auth route group
removed; `apps/scraper` has a hello-world CLI. Both are wired into the validate gate. Add
features in subsequent PRs.
