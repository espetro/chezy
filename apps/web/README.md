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

## Repeatable rental demo (JES-5)

From a fresh checkout, at the repository root:

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
cp -n apps/web/.env.example apps/web/.env.local
mise run demo:setup
mise run demo:check
mise run dev
```

Keep `VIEWING_MODE=mock` and `CALENDAR_MODE=mock` for rehearsal. No provider key is
needed for the rental persona/feed; chat and live calls are separate flows.
`demo:setup` starts pg0, migrates and upserts the 300 bundled fixture listings. It
does not delete users or their profiles. For a custom pg0 port, set `POSTGRES_URL`
to the URI from `mise run db:status`.

Migrations must load the environment **before** importing the env parser:

```sh
mise run db:start
cd apps/web
mise exec -- node --env-file=.env.local --import=tsx lib/db/migrate.ts
cd ../..
mise run db:seed
# Production build, with pg0 still running (use your pg0 URI if customized):
POSTGRES_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres" mise exec -- pnpm build
```

Alternatively, export `POSTGRES_URL` in the shell and use `mise exec -- pnpm build`
from the root. The ordinary migration script can silently skip migrations if it
reads the env parser before dotenv runs; `demo:setup` avoids that import-order issue.

### Shortest recording path

1. Open `/onboarding` in an incognito window. The existing guest-auth redirect
   creates a new identity; clearing browser cookies creates another identity.
2. At the top of onboarding, expand **Demo tools** and click **Reset and load demo**. The current guest's two profile stores are
   replaced, old auto-call markers are removed, and the app opens `/explore`.
3. Inspect the candidates, then return to `/onboarding` and click the same button.
   The persona and candidate IDs should match the first run. Row UUIDs and
   timestamps are regenerated.
4. **Reset to empty onboarding** instead clears both profiles and restarts
   onboarding. It preserves login and other users' database records.

The control appears in development or with `IS_DEMO=1`. Normal production returns
404 for the reset endpoint. Production demo mode uses the existing `/demo` base
path (set `IS_DEMO=1` at build and runtime). Both provider modes must be mock before
the reset succeeds. This does not replace JES-11's call-safety checks; do not change
provider modes during a rehearsal. Historical calls/calendar events are not undone.

### Canonical persona and fixture disclosure

`lib/demo/persona.ts` defines the Norrsken / Poblenou 22@ persona: €1,500–2,500/month,
2 bedrooms, 60 m², Poblenou or Sant Martí, balcony/terrace, 25-minute commute,
flexible date (15 days), alerts off. The work location uses the existing static
Glòries / 22@ anchor (41.4036, 2.187), not a live geocoder or exact Norrsken address.

Listings come from the checked-in `chezy-mock-data/data/listings.jsonl` fixture
snapshot, not a fresh availability check. Photos remain remote URLs. Useful
candidate IDs verified by `demo:check`:

- `fotocasa:190866104` — €2,300, 2 bedrooms, 77 m², Sant Martí, balcony/terrace.
- `fotocasa:190451552` — €2,400, 2 bedrooms, Eixample, balcony.
- `fotocasa:189698965` — €2,100, 3 bedrooms, 75 m², El Raval, balcony.

There are fewer than eight strict neighbourhood matches. The existing feed widens
area and neighbourhood filters to fill the feed and reports the relaxation note.
Prices can include the existing 15% budget headroom. Fixture entries can represent
the same home on multiple portals; these are candidate listing IDs, not a claim
of unique or currently available homes. Ranking/scoring is unchanged.

### Reset API and downstream cleanup seam

`POST /api/demo/reset` takes JSON `{ "loadPersona": true }` (seed) or
`{ "loadPersona": false }` (empty), and uses only the authenticated session ID.
Unknown fields, including `userId`, are rejected. Responses: 200 `{ reset: true,
profile? }`, 401 unauthenticated, 404 disabled, 403 cross-origin, 400 invalid input,
415 non-JSON, 409 non-mock provider modes, 500 transactional failure.
Calling the API directly does not clear localStorage; the onboarding control clears
only `chezy:autocall:*` keys. Those legacy keys are browser-scoped, not user-scoped;
other localStorage entries and other browsers are preserved.

`lib/demo/reset.ts` exports `DemoResetTransaction`, `DemoUserCleanup`,
`demoUserCleanups`, and `resetDemo(userId, loadPersona, cleanups?)`. JES-8/JES-12 can
import their cleanup functions into `demoUserCleanups`: each receives the current
transaction and authenticated `userId`, must filter writes by that ID, and must
throw on failure. Callbacks run before profile deletion/seeding, under a row lock
on that User; all database changes roll back together. Do not enqueue external
work inside callbacks. No schema migration is needed here.

`mise run demo:check` uses two disposable users and the real database/feed to verify
two identical seeded runs, another user's untouched records, rollback, concurrent
resets, and at least three pinned fixture candidates. It deletes only those test
users afterward. Route auth/gates and marker filtering also have Vitest coverage.
