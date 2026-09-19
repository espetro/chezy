# Architecture

> Source-of-truth for chezy's module graph, boundary rules, and how `apps/web` /
> `apps/scraper` / `packages/*` fit together. Linked from `AGENTS.md` and from the repo
> root as `ARCHITECTURE.md`.

## Module graph

```
                        ┌─────────────────────────────────┐
                        │           apps/web              │
                        │  Next.js 16 + React 19 + AI SDK │
                        │   · app/(chat)/* (UI routes)     │
                        │   · app/api/chat/route.ts       │
                        │   · components/chat/*           │
                        │   · lib/ai/* (model registry)   │
                        └────┬───────────┬───────────┬────┘
                             │           │           │
              ┌──────────────┘           │           └──────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
      ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
      │ packages/db  │           │ packages/    │           │ packages/    │
      │ Drizzle      │           │ contract     │           │ config       │
      │ schema +     │           │ wire types   │           │ Valibot env  │
      │ client +     │           │ shared       │           │ parser       │
      │ pg0 helper   │           │ between web  │           │ single       │
      │              │           │ and api      │           │ source of    │
      └──────┬───────┘           └──────┬───────┘           │ truth        │
             │                          │                   └──────┬───────┘
             │                          │                          │
             ▼                          ▼                          ▼
      ┌──────────────────────────────────────────────────────────────┐
      │                       packages/ui                            │
      │  Shared React primitives (escape hatches, shadcn wrappers,   │
      │  useMountEffect). No data, no env, no framework imports.     │
      └──────────────────────────────────────────────────────────────┘

      apps/scraper (separate workspace, no import path to packages/*)

             ┌──────────────────────────────────────┐
             │              apps/scraper            │
             │  uv-managed Python CLI.              │
             │  httpx + parsel + pydantic.          │
             │  Runs independently as a CLI;        │
             │  not imported by apps/web (yet).     │
             └──────────────────────────────────────┘
```

## Boundary rules

### Client vs server

`apps/web` follows `vercel/chatbot`'s Server Components + Route Handlers split. UI routes
under `app/(chat)/*` are rendered server-side; the chat API is a Route Handler at
`app/api/chat/route.ts`. Browser-only code (`'use client'` components) must not
value-import server-only modules.

Enforced by `no-restricted-imports` in `.oxlintrc.json`:

- Components and routes cannot import `packages/db`, `packages/config/server`, or any
  `*.server.ts` module directly. Reach the server via a Route Handler or Server Action.
- `process.env` reads are banned outside `packages/config` and `*.config-bound.ts`.

### Workspace dependencies

The dependency graph must be `apps/*` → `packages/*` → (nothing). `packages/*` cannot
import from `apps/*`. Enforced by oxlint + a future `scripts/check-workspace-manifests.ts`.

```
apps/web       →  packages/ui, packages/db, packages/config, packages/contract
apps/scraper   →  (workspace-isolated; no cross-package imports yet)
packages/db    →  packages/contract, packages/config
packages/ui    →  packages/config (env, optional)
packages/contract  →  nothing
packages/config   →  nothing
```

### Python ↔ TypeScript

`apps/scraper` is a separate `uv` workspace member. It owns its own `.venv` and lockfile
contributions. There is **no API contract yet** between `apps/scraper` and `apps/web`;
when one is added (later), it will live in `packages/contract` as Valibot / Pydantic
schemas consumed by both sides.

## Dependency injection

- **Env**: every env read goes through `packages/config` (Valibot parser). UI code imports
  `import { env } from "@chezy/config"`; CLI scripts import `from chezy_config import env`.
- **DB**: Drizzle client is a singleton in `packages/db/src/client.ts`. Tests construct a
  per-test client via `createTestDb()` (planned, not on day 0).
- **AI models**: registered in `apps/web/lib/ai/models.ts`. Each model gets its own
  `provider` + API key pulled from `packages/config`.

## Lint-enforced boundaries (summary)

| Rule | What | Where |
| --- | --- | --- |
| `no-restricted-imports` | Zod, Biome, `@/*` alias, server-only modules in client graph | `.oxlintrc.json` |
| `no-restricted-properties` | `process.env` outside config | `.oxlintrc.json` |
| `no-restricted-syntax` | `useEffect` calls | `.oxlintrc.json` |
| `react/exhaustive-deps` | Catch stale dep arrays | `.oxlintrc.json` (react plugin) |
| `react/react-compiler` | Enforce React Compiler-compatible code | `.oxlintrc.json` (type-aware) |
| `unicorn/no-null` | `T \| null` only at wire / DB / contract seams | `.oxlintrc.json` |

## Failure modes we explicitly design for

- **Cross-worktree venv poisoning**: never share `.venv` across worktrees (see
  `.agents/docs/worktree-disk-budget.md`). Each worktree gets its own `uv sync`.
- **Hardlink package pollution**: don't override `packageImportMethod=hardlink`. APFS
  hardlinks CoW-materialize across worktrees.
- **Stale validate gate**: lefthook pre-push runs `mise run validate` over every commit,
  not just your diff. Bypass is forbidden.
- **`useEffect` misuse**: enforced by lint + the five-pattern rule from the `no-use-effect`
  skill.
