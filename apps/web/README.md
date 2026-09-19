# apps/web

Next.js 16 + React 19 + AI SDK 7 fork of [`vercel/chatbot`](https://github.com/vercel/chatbot),
adapted for chezy:

- **Auth removed**: the `(auth)` route group is gone. `next-auth` is not a dependency.
- **Zod → Valibot**: `lib/env.ts` parses env with Valibot (see `../../.oxlintrc.json`
  for the `no-restricted-imports` rule that bans the `zod` package).
- **Biome → oxlint/oxfmt**: `biome.jsonc` is replaced by the monorepo-root
  `.oxlintrc.json` + `.oxfmtrc.json`.
- **Neon → pg0**: the Drizzle client points at
  `postgresql://postgres:postgres@127.0.0.1:5432/postgres` (started via
  `mise run db:start`).
- **Vercel Blob / AI Gateway**: kept on, but configurable via env so non-Vercel
  deploys work (see `lib/env.ts` when it ships).

## Two-tier validation policy

Per `../../AGENTS.md` and the design notes:

| Tier | When | Tool | Command |
|---|---|---|---|
| 1 — app-level | Default for any feature | `agent-browser` (pinned in mise) or `playwright` (lazy) | `mise run browser:smoke` |
| 2 — component-level | App-level setup is conflicting or polluted | `react-cosmos` for isolated fixtures | `mise run cosmos` |

Use tier 2 first when iterating on a single component; graduate to tier 1 when
the component composes into the wider app surface.

## Day-0 scope

- One page (`app/page.tsx`) that renders a placeholder.
- One Vitest smoke test in `src/__tests__/smoke.test.ts` so the validate gate
  exits 0 on an empty tree.
- `lib/env.ts` is a placeholder; the Valibot parser lands with the first feature.

## Future tickets

- Wire `app/(chat)/page.tsx`, `app/api/chat/route.ts`, the AI Gateway registry,
  the Valibot env parser, the Drizzle schema (in `packages/db`), the chat UI
  components (likely `assistant-ui` for type-safe thread persistence), the
  shadcn/ui theme via `tailwind-theme-builder` skill.
- Wire `cosmos.config.ts` + `src/components/__cosmos__/` fixtures so every
  component ships with a Cosmos fixture by default.
