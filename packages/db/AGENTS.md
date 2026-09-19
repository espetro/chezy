# `@chezy/db` — agent instructions

Scope: Drizzle schema + migrations + branded entity IDs. Inherits root
[`AGENTS.md`](../../AGENTS.md) rules; this file adds db-specific
invariants.

## What's in this package

- `src/schema/*` — Drizzle table definitions (one file per table or per
  domain area). The shared DDL source of truth.
- `src/index.ts` — re-exports the schema + the Drizzle client
  constructor. The Drizzle client itself is created in `apps/web/lib/db/`
  (app-local, reads `POSTGRES_URL`).
- `drizzle.config.ts` — drizzle-kit config (dialect, schema path,
  migration output).

## Client-graph ban

Components and routes must NOT value-import `@chezy/db` directly. Reach
the server via a Route Handler or Server Action (`app/api/*/route.ts`),
or via `createServerFn` bodies if/when they exist. Enforced by oxlint
`no-restricted-imports` on `drizzle-orm/*` (root AGENTS.md).

The split is deliberate: `apps/web/lib/db/` holds the **client**
(knows the connection URL, lazy-connects, never leaks into the browser
bundle). `@chezy/db` holds the **schema** (pure types + table defs,
safe in any graph).

## Adding a new table

1. Create `src/schema/<table>.ts` (snake_case filename matching the
   table name; one file per domain table).
2. Export a `<table>Table` `pgTable(...)` constant. Column naming is
   snake_case in SQL, camelCase in the TS binding (Drizzle convention).
   IDs are `uuid().primaryKey().defaultRandom()` unless they need to be
   branded (see below).
3. Export a `<Table>` inferred type alias
   (`InferSelectModel<typeof tableTable>`) for downstream code.
4. Re-export the table from `src/schema/index.ts` so consumers can
   `import { fooTable } from "@chezy/db"`.
5. Generate the migration: `pnpm --filter @chezy/web db:generate`.
   This reads `apps/web/lib/db/schema.ts` (the app-local schema barrel —
   today it holds the verbatim upstream tables; shared domain tables
   land in `packages/db/src/schema/` and get re-exported there) and writes
   `apps/web/lib/db/migrations/<timestamp>_<name>.sql`.
6. Apply: `pnpm --filter @chezy/web db:migrate`. This runs against the
   pg0 instance started via `mise run db:start`.
7. **One commit per migration** — schema change + generated SQL in one
   atomic commit so the migration and the schema diff never disagree.

`db:push` skips the migration file and pushes the schema directly to
the DB. Dev only; **never on shared DBs** (no migration history means
no rollback).

## Naming conventions

- **Tables**: snake_case plural (`chat_messages`, not `ChatMessage`).
- **Columns**: snake_case in SQL (`created_at`); camelCase in the TS
  binding (`createdAt`).
- **Primary keys**: `uuid().primaryKey().defaultRandom()`. No serial
  ints — they leak row counts.
- **Foreign keys**: `<other_table_singular>_id` (e.g.
  `chat_session_id` on `chat_messages`).
- **Timestamps**: every table gets `createdAt` and `updatedAt`
  (`timestamp().notNull().defaultNow().$onUpdate(() => new Date())`).
- **Soft-delete**: prefer `deletedAt` nullable timestamp over a
  hard delete when the data has downstream audit rows.

## When to migrate vs push

- **`db:generate` + `db:migrate`** for any change that lands on a
  shared DB (CI, staging, prod). The migration file is the contract.
- **`db:push`** only for throwaway local experiments that you don't
  intend to commit. Anything in a PR must use migrations.
- **Backfills** (changing a column's type or adding a NOT NULL) get
  their own migration with both the DDL and the data fix in one file
  (drizzle-kit's `sql\`...\`` for the data step). Two migrations
  ("add nullable column" + "backfill + set NOT NULL") is also fine —
  pick the one that's reversible on partial failure.

## Verification

- `pnpm --filter @chezy/db test` — vitest suite for branded-id
  constructors and any pure functions in this package.
- `pnpm --filter @chezy/web typecheck` — typechecks the whole web app,
  which catches schema drift (e.g. a query selecting a column that no
  longer exists).
- `pnpm --filter @chezy/web db:studio` — browser DB inspector against
  the running pg0 instance.