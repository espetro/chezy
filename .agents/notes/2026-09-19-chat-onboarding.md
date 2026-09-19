# 2026-09-19 — chat onboarding landed + drizzle snapshot footgun

## What landed (feat/chat-onboarding)

In-chat onboarding per `.agents/plans/2026-09-19-chat-onboarding.md`:
`User.username` (unique) + `User.profile` (jsonb, `$type<UserProfile>`),
`identifyUser`/`saveUserProfile` tools, onboarding section in `systemPrompt`.
Identity = username-keyed `User` rows (synthetic `<username>@chezy.local`
email); guest session rows stay chat-only. Gate: no search until `areas` +
`budgetMaxEur` + `bedroomsMin` present.

## Surprises worth keeping

- **`meta/0000_snapshot.json` was never committed** — only `_journal.json`
  existed. First `drizzle-kit generate` after that produced a bogus
  full-recreate migration. Reconstructed the snapshot by generating against
  HEAD's schema via a temp config; committed `0000_snapshot.json` with the real
  `0001` migration. If `db:generate` ever emits `CREATE TABLE` for tables that
  already exist, check `lib/db/migrations/meta/` snapshots are all tracked.
- **Valibot works directly as AI SDK 7 `tool()` `inputSchema`** (Standard
  Schema) — no zod needed for new tools even inside the exempt `apps/web`.
- `pnpm --filter @chezy/web db:generate` works offline; `db:migrate` needs pg0
  up (`mise run db:status` first). The `0001` migration was applied to the
  running pg0 during this session.
- `apps/web` has no `typecheck` script — use `pnpm exec tsc --noEmit -p
  tsconfig.json` inside `apps/web`.
