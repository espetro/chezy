# packages/db

Drizzle schema + Drizzle client + pg0 lifecycle helper. Day-0 stub.

## Boundary rules

- This is a **server-only** package. Components and routes under
  `apps/web/src/components/**` and `apps/web/src/routes/**` may not
  value-import from `@chezy/db` (enforced by `.oxlintrc.json`).
- Reach the server via a Route Handler / Server Action.
- Never import from `apps/*` — `packages/db` is at the leaf of the dep graph.

## Day-0 shape

```
src/
  index.ts          public surface (re-exports schema + client + pg0 helpers)
  schema/
    chats.ts        chats table (parent_id chain for branching)
    messages.ts     messages table (parts jsonb)
  client.ts         getDb() singleton
  pg0.ts            startPg0(), stopPg0(), resetPg0()
  testDb.ts         createTestDb() for vitest integration tests
```

## Migrations

Drizzle migrations live under `drizzle/`. Use `drizzle-kit generate` and
`drizzle-kit migrate`. The first migration must add the breakpoint marker
(when multi-statement SQL lands, port `check-migration-breakpoints.ts` from
`../brioso` — see `.agents/notes/2026-09-19.md`).
