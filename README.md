# chezy

Chat-centric AI webapp, 0→1 hackathon build. See [`AGENTS.md`](AGENTS.md) for the canonical
agent instructions (enforced gates + conventions).

## Layout

```
apps/
  web/        Verbatim import of vercel/chatbot (Next.js 16 + React 19 + AI SDK 7).
              NextAuth guest auth kept; Neon → pg0, @ai-sdk/gateway →
              @ai-sdk/openai-compatible (Nebius AI Studio). Reference copy in
              apps/web/vendor/chatbot-template/.
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
  docs/                  Long-form reference docs (architecture, design, screens).
```

No `.github/workflows/` exists yet — `mise run validate` runs only via the lefthook
pre-push hook.

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
cp apps/web/.env.example apps/web/.env.local   # then set OPENAI_COMPATIBLE_API_KEY
                                               # to your Nebius key (NEBIUS_API_KEY)
mise run db:start
pnpm --filter @chezy/web db:migrate            # create the chat tables
mise run dev
```

The dev server starts on `http://localhost:3000` (Next.js). `pg0` listens on
`postgresql://postgres:postgres@127.0.0.1:5432/postgres`; the Drizzle client reads
`POSTGRES_URL` from `apps/web/.env.local`. The chat model comes from Nebius AI Studio —
`OPENAI_COMPATIBLE_BASE_URL=https://api.studio.nebius.com/v1`, default model
`Qwen/Qwen3-235B-A22B-Instruct-2507` (see `apps/web/.env.example` for all four
`OPENAI_COMPATIBLE_*`/`CHEZY_*` vars). On first load `/` redirects to `/api/auth/guest`
to mint a guest session — that's the template's NextAuth flow, keep it.

## Current scope

`apps/web` is the verbatim `vercel/chatbot` template: working chat against an
OpenAI-compatible provider (Nebius), NextAuth guest auth, Drizzle chat persistence on
pg0, plus a voice viewing flow (`lib/slng.ts`, `lib/vonage.ts`, `lib/calendar.ts`,
`/api/viewing`, `/api/calendar`; `VIEWING_MODE`/`CALENDAR_MODE` env switches, mock by
default). `apps/scraper` has a hello-world CLI. Both are wired into the validate gate.
