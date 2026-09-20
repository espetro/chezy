# Architecture

> Source-of-truth for chezy's module graph, boundary rules, and how `apps/*` /
> `packages/*` fit together. Linked from `AGENTS.md` and from the repo root via
> `ARCHITECTURE.md`.

## Module graph

```
                        ┌──────────────────────────────────────┐
                        │              apps/web                │
                        │  Next.js 16 + React 19 + AI SDK 7    │
                        │   · app/(flow)/* product surface     │
                        │     (/ onboarding explore/[id])      │
                        │   · app/(chat)/* kept for reuse      │
                        │   · app/api/{chat,profile,viewing,   │
                        │     calendar,...} route handlers     │
                        │   · lib/ai/* tools, models, memory   │
                        │   · lib/{match,feed,listings}.ts     │
                        │   · lib/{slng,vonage,viewing-call,   │
                        │     calendar}.ts (voice + calendar)  │
                        └────┬───────────┬───────────┬─────────┘
                             │           │           │
            deliberate       │           │           │
            exception        │           │           │
       ┌─────────────────────┘           │           └──────────────┐
       │                                 │                          │
       ▼                                 ▼                          ▼
┌──────────────┐                 ┌──────────────┐           ┌──────────────┐
│  apps/bot    │                 │ packages/db  │           │ packages/    │
│  @chezy/bot  │   ~/* paths     │ stub — real  │           │ contract     │
│  Mastra      │   ──────────►  │ schema lives │           │ Valibot wire │
│  agent +     │   (read-only   │ in apps/web/ │           │ schemas      │
│  @mastra/    │   apps/web/lib)│ lib/db/*     │           │              │
│  telegram    │                └──────┬───────┘           └──────┬───────┘
│  polling +   │                       │                          │
│  @mastra/hono│                       ▼                          ▼
│  on :4111    │                ┌──────────────────────────────────────┐
│  bot.*       │                │           packages/observability     │
│  mastra.*    │                │  LogTape facade + JSONL audit sink   │
│  schemas     │                │  .audit/<service>-<date>.jsonl       │
└──────────────┘                │  chat.turn.* from web route + bot    │
                                │  ChezyAuditExporter                  │
      apps/video                └──────────────────────────────────────┘
      Remotion demo video,
      no runtime deps on apps/*

      packages/ui    shared React primitives (shadcn, useMountEffect)
      packages/config  placeholder Valibot env seam (not yet the real
                       reader — see Dependency injection)

             ┌──────────────────────────────────────┐
             │              apps/scraper            │
             │  uv-managed Python CLI: httpx +      │
             │  parsel + pydantic. Five adapters:   │
             │  idealista, fotocasa, habitaclia,    │
             │  milanuncios, pisos. The pisos one   │
             │  was built by the Devin forge loop   │
             │  (scripts/devin-forge: API-driven    │
             │  sessions + pytest gates + feedback) │
             └──────────────────────────────────────┘
```

## Boundary rules

### Client vs server

`apps/web` follows `vercel/chatbot`'s Server Components + Route Handlers split. The
product surface lives under `app/(flow)/*` (`/` landing → `/onboarding` → `/explore` →
`/explore/[id]`); the dropped `/chat` pages' API routes under `app/(chat)/api/*` are
kept for reuse. APIs: `/api/chat`, `/api/profile`, `/api/profile/count`,
`/api/viewing`, `/api/calendar` (plus `api/{demo,explain,feedback,saved}`). Browser-only
code (`'use client'` components) must not value-import server-only modules.

`apps/bot` adds no web routes; it serves Mastra's agent API plus
`POST /internal/radar/run` on `BOT_PORT` (4111).

Enforced by `no-restricted-imports` in `.oxlintrc.json`:

- Components and routes cannot import `packages/db`, `packages/config/server`, or any
  `*.server.ts` module directly. Reach the server via a Route Handler or Server Action.
- `process.env` reads are banned outside `packages/config` and `*.config-bound.ts`
  (with the two real seams listed under Dependency injection).

### Workspace dependencies

The dependency graph is `apps/*` → `packages/*` → (nothing), with one deliberate,
temporary exception: `apps/bot` imports `apps/web/lib` read-only via the `~/*` tsconfig
path (with a `server-only` shim). Rationale: `apps/web` is the reference implementation
for the hackathon, and the bot must conform to web's tools, scorer, and prompts rather
than fork them. Exit path: extract shared domain modules into `packages/domain` — see
`.agents/plans/2026-09-20-shared-agent-observability.md`, "What this plan deliberately
does not do".

```
apps/web       →  packages/ui, packages/contract, packages/observability
apps/bot       →  apps/web/lib (read-only exception), packages/contract,
                  packages/observability; bot.* and mastra.* Postgres schemas
apps/scraper   →  (workspace-isolated; no cross-package imports)
apps/video     →  (Remotion, standalone)
packages/db    →  packages/contract  (stub — schema still lives in apps/web/lib/db)
packages/ui    →  packages/config (env, optional)
packages/contract        →  nothing
packages/config          →  nothing
packages/observability   →  nothing
```

### Python ↔ TypeScript

`apps/scraper` is a separate `uv` workspace member with its own `.venv`. There is no
API contract between `apps/scraper` and `apps/web` yet; when one is added it will live
in `packages/contract` as Valibot / Pydantic schemas consumed by both sides.

## Dependency injection

- **Env**: the real `process.env` seams today are `apps/web/lib/env.ts` and
  `apps/bot/src/env.ts` (Valibot schema + `v.parse`, one `env` object per app).
  `packages/config` exists as the intended shared seam but is still a placeholder —
  it does not own the parsing yet.
- **DB**: pg0 (embedded Postgres 18 + pgvector) on :5432. The real Drizzle schema and
  postgres-js client live in `apps/web/lib/db/*` (`schema.ts` incl. the pgvector
  `Memory` table, `client.ts`, `migrations/`); `packages/db` is a stub re-exporting a
  partial schema, not yet the seam. `apps/bot` reuses the web client and owns the
  `bot` schema (`telegram_users`, `radar_seen`) plus Mastra storage/memory in the
  `mastra` schema.
- **AI models**: registered in `apps/web/lib/ai/models.ts` and `providers.ts` —
  `@ai-sdk/openai-compatible`, `custom/<CHEZY_MODEL_ID>` against
  `OPENAI_COMPATIBLE_BASE_URL`. `apps/bot` uses the same env vars through Mastra's
  model router.
- **Memory, two kinds**: web keeps long-term facts in the `Memory` table (pgvector,
  `lib/ai/memory.ts`); the bot uses Mastra `Memory` (`lastMessages` 20 + working-memory
  housing template) on `@mastra/pg`.
- **Voice/calendar**: `VIEWING_MODE` = mock|slng|vonage selects `lib/slng.ts` /
  `lib/vonage.ts` / mock behind `lib/viewing-call.ts`; `CALENDAR_MODE` = mock|google
  behind `lib/calendar.ts`.
- **Observability**: `configureLogger({ service })` once per process;
  `createAuditLogger("<sub>").emit(...)` writes flat JSONL records to
  `.audit/<service>-<date>.jsonl`. Both surfaces emit the same `chat.turn.*`
  vocabulary: the web route summarizes each streamed turn via
  `lib/ai/turn-audit.ts`, and the bot's `ChezyAuditExporter` derives the same shape
  from Mastra trace spans.

## Lint-enforced boundaries (summary)

| Rule | What | Where |
| --- | --- | --- |
| `no-restricted-imports` | Zod, Biome, `@/*` alias, server-only modules in client graph | `.oxlintrc.json` |
| `no-restricted-properties` | `process.env` outside the env seams | `.oxlintrc.json` |
| `no-restricted-syntax` | `useEffect` calls | `.oxlintrc.json` |
| `react/exhaustive-deps` | Catch stale dep arrays | `.oxlintrc.json` (react plugin) |
| `react/react-compiler` | Enforce React Compiler-compatible code | `.oxlintrc.json` (type-aware) |
| `unicorn/no-null` | `T \| null` only at wire / DB / contract seams | `.oxlintrc.json` |

## Failure modes we explicitly design for

- **Cross-worktree venv poisoning**: never share `.venv` across worktrees. Each
  worktree gets its own `uv sync`.
- **Hardlink package pollution**: don't override `packageImportMethod=hardlink`. APFS
  hardlinks CoW-materialize across worktrees.
- **Stale validate gate**: lefthook pre-push runs `mise run validate` over every commit,
  not just your diff. Bypass is forbidden.
- **`useEffect` misuse**: enforced by lint + the five-pattern rule from the
  `no-use-effect` skill.
- **Bot↔web drift**: the `apps/bot → apps/web/lib` exception is tolerated only while
  web stays the reference; any shared logic must live in `apps/web/lib` (consumed
  read-only), not in a new shared package, until the `packages/domain` extraction.
