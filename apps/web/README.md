# apps/web

Next.js 16 + React 19 + AI SDK 7 **verbatim import** of
[`vercel/chatbot`](https://github.com/vercel/chatbot) (PR #2). A pristine reference copy
lives at `vendor/chatbot-template/` (excluded from tsconfig). Deliberate diffs so far:

- **Auth kept**: the `(auth)` route group is intact — NextAuth 5 with a `guest`
  credentials provider. `/api/chat` returns `unauthorized:chat` without the session
  cookie; `/` redirects to `/api/auth/guest` once to mint one.
- **Neon → pg0**: the Drizzle client points at
  `postgresql://postgres:postgres@127.0.0.1:5432/postgres` via `POSTGRES_URL`
  (started via `mise run db:start`).
- **AI Gateway → OpenAI-compatible**: `@ai-sdk/openai-compatible`
  (`lib/ai/providers.ts`, `lib/ai/models.ts`) replaces `@ai-sdk/gateway`. The project
  provider is Nebius AI Studio; env vars are `OPENAI_COMPATIBLE_BASE_URL`,
  `OPENAI_COMPATIBLE_API_KEY`, `CHEZY_MODEL_ID`, `CHEZY_TITLE_MODEL_ID` — see
  `.env.example`. The code default base URL is a local bifrost at
  `http://localhost:8317/v1`; the code default model is `deepseek-ai/DeepSeek-V4.1-Flash`.
- **Voice viewing flow**: `lib/slng.ts` (SLNG agent), `lib/vonage.ts` (Vonage Voice API),
  `lib/calendar.ts`, plus `/api/viewing` and `/api/calendar`. `VIEWING_MODE` /
  `CALENDAR_MODE` env switches default to `mock`.

Still upstream, not yet chezy-aligned (see `AGENTS.md` manual-review checklist): zod,
the `@/*` alias, `useEffect`, and direct `process.env` reads. `apps/web` ships no
`biome.jsonc` (only `vendor/chatbot-template/` has one) and is linted by nothing today —
the repo-root `.oxlintrc.json` excludes `apps/web/**` via `ignorePatterns`.

## Two-tier validation policy

Per `../../AGENTS.md` and the design notes:

| Tier | When | Tool | Command |
|---|---|---|---|
| 1 — app-level | Default for any feature | `agent-browser` (pinned in mise) or `playwright` (lazy) | `mise run browser:smoke` |
| 2 — component-level | App-level setup is conflicting or polluted | `react-cosmos` for isolated fixtures | `mise run cosmos` |

Use tier 2 first when iterating on a single component; graduate to tier 1 when
the component composes into the wider app surface.

## Environment

Copy `.env.example` to `.env.local` and set `OPENAI_COMPATIBLE_API_KEY` to the Nebius
key (provisioned as `NEBIUS_API_KEY`; the same key backs the future smart-KPI feature).
Defaults point at Nebius AI Studio (`https://api.studio.nebius.com/v1`, chat model
`deepseek-ai/DeepSeek-V4.1-Flash`, title model `Qwen/Qwen3-30B-A3B-Instruct-2507`).
Then `mise run db:start` (from the repo root) and `pnpm db:migrate` here to create the
chat tables.
