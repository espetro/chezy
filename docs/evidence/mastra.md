# Evidence: Mastra challenge

Challenge (from [`docs/hackbarna.md`](../hackbarna.md)): build an agent people can
message. Live bot + public repo required; the bot handle must be submitted before the
deadline and stay reachable through judging.

## The agent

**[@hackbarna_chezybot](https://t.me/hackbarna_chezybot)** — a second client for the
same concierge, built on Mastra in [`apps/bot`](../../apps/bot) (merged via
[PR #53](https://github.com/espetro/chezy/pull/53), package `@chezy/bot`).

It is an adapter, not a fork: it imports `apps/web/lib` read-only (tools, listings,
insights) and adds only Telegram-specific pieces. Follow-ups that matter for judging:

- [PR #75](https://github.com/espetro/chezy/pull/75) — the bot adapts the web tools
  (`saveUserProfile`, `searchListings`, `recordListingFeedback`,
  approval-gated `arrangeViewing`), so cards carry the real match `N/100` score and
  non-empty `topMatches` produce an explicit viewing offer.
- [PR #79](https://github.com/espetro/chezy/pull/79) — per-turn `chat.turn.*` audit
  records on both surfaces: the web chat route summarizes each streamed turn via
  `lib/ai/turn-audit.ts`, and the bot's `ChezyAuditExporter` derives the same record
  shape from Mastra trace spans.

See the README section "Message chezy on Telegram" for the criteria mapping.

## How it meets the judging criteria

| Criterion | Implementation |
| --- | --- |
| Messageable from a stranger's phone | `@mastra/telegram` in polling mode — no webhook/tunnel; `TELEGRAM_ALLOWED_USER_IDS` empty so any user can DM |
| Memory | Mastra `Memory` on `@mastra/pg` (dedicated `mastra` schema): last 20 messages + working-memory template persisting budget, neighbourhoods, must-haves, red lines |
| Approval-gated actions | `arrangeViewing` never fires on its own: the agent proposes, Telegram shows an approve/deny inline keyboard, only approval dispatches (mocked via `VIEWING_MODE=mock`) |
| Proactive | Radar loop re-scores `buildFeed` per linked user and DMs fresh matches above `RADAR_MIN_SCORE`, deduped via `bot.radar_seen`; `mise run bot:radar` runs a pass on demand |
| Identity | Telegram user → Chezy user mapping in `bot` schema (`src/identity.ts`) |
| Model | Mastra model router over `OPENAI_COMPATIBLE_*` env — see "Model" below |
| Observability | `chat.turn.complete`/`chat.turn.fail` audit records (channel, model, latency, tools, cited listing ids) via `ChezyAuditExporter`; `mise run audit:turns` tabulates them |

Key files: `src/mastra.ts` (agent + memory), `src/telegram.ts` (polling channel),
`src/tools/adapt.ts` (web tools → Mastra tools), `src/radar/` (proactive loop),
`src/observability/audit-exporter.ts` (Mastra traces → audit records),
`test/fake-telegram.ts` + `test/harness.ts` (fake-Telegram test suite).

## Status

- Live deployment runs from `~/.worktrees/chezy-0/deploy` (detached at `main`,
  a PR #75 build), in polling mode on `BOT_PORT` 4111, up since ~13:00 CEST.
- PR #79 (per-turn audit) is merged to `main` but the live process has not been
  redeployed with it yet.
- Handle submitted before the 12:00 deadline (per
  `.agents/notes/2026-09-20-hackbarna-tracks.md`).

### Safety

`VIEWING_MODE=mock` and `CALENDAR_MODE=mock` reach the bot through
`apps/web/.env.local`, which `apps/bot/src/env.ts` falls back to for shared vars, so a
judge tapping Approve cannot ring a real phone or touch a real calendar.
`TELEGRAM_ALLOWED_USER_IDS` is empty: any Telegram account can DM the bot.

### Model

The code routes `custom/<CHEZY_MODEL_ID>` at `OPENAI_COMPATIBLE_BASE_URL` through
Mastra's model router. The live deployment's `apps/bot/.env` points at the local
bifrost gateway (`http://localhost:8317/v1`) with
`CHEZY_MODEL_ID=minimax-coding-plan/MiniMax-M3`. Nebius AI Studio
(`deepseek-ai/DeepSeek-V4.1-Flash`) remains the code default and is what `apps/web`
uses; the live Telegram bot does not run on Nebius.

## Verification

- **Fake Telegram Bot API harness** (`test/fake-telegram.ts`): serves `getMe`, a
  `getUpdates` queue the test pushes DMs/`callback_query`s into, and records
  `sendMessage`/`editMessageText` payloads so tests can assert on message text and
  inline keyboards.
- **Nine Vitest cases** (`pnpm --filter @chezy/bot test`):
  - `telegram e2e (fake Bot API)` — "answers a plain DM"; "gates arrangeViewing behind
    an approval card"
  - `radar` — "alerts once per unseen matching listing"
  - `adaptTool` — "strips username from the advertised input schema"; "injects the
    username from request context on execute"; "throws when no username is on the
    context"
  - `ChezyAuditExporter` — "emits one chat.turn.complete audit record per agent run";
    "drops trace buffers older than the TTL"; "emits chat.turn.fail with
    telegram:unknown actor when the root span errors"
- **Pre-push gate**: `mise run validate` (lefthook) — typecheck, lint, format, tests.
- **Live token check**: `getMe` resolved the bot handle (`chezybot`) and
  `telegram connected (polling)` logged at startup; live log at
  `/tmp/chezy-bot-live-judging.log`.

## Judge-facing behaviour

From `apps/bot/src/instructions.ts` (wording mirrors `apps/web/lib/ai/prompts.ts`):

- **Onboarding, one question at a time**: "Ask in this order: areas … → budget in EUR →
  bedrooms. Then invite free-form requirements … and save them as
  freeformRequirements." Plus "Ask one question at a time. This is a phone screen."
- **Off-topic rule**: "If the message has nothing to do with finding a flat in
  Barcelona, answer briefly and steer back. You are a housing assistant, not a general
  chatbot — but don't be rude about it."
- **Cards**: "match N/100 · first reason · price €/month · rooms · m² · neighbourhood",
  at most 3 per message, first card's `coverUrl` on its own line for the photo preview.
- **Viewing offer**: "When `topMatches` is non-empty, name the best match and ask
  whether to arrange a visit."
- **Approval**: "It will ask them to approve before a phone call is placed to the
  agency — tell them that plainly." The approval arrives as an approve/deny inline
  keyboard (`callback_query`), not a text reply.
- **Radar DM**: proactive alert when a fresh listing scores above the radar threshold —
  the agent initiates the conversation, not only replies.
