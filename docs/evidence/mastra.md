# Evidence: Mastra challenge

Challenge (from [`docs/hackbarna.md`](../hackbarna.md)): build an agent people can
message. Live bot + public repo required; the bot handle must be submitted before the
deadline and stay reachable through judging.

## The agent

**[@hackbarna_chezybot](https://t.me/hackbarna_chezybot)** — a second client for the
same concierge, built on Mastra in [`apps/bot`](../../apps/bot) (merged via
[PR #53](https://github.com/espetro/chezy/pull/53), package `@chezy/bot`).

It is an adapter, not a fork: it imports `apps/web/lib` read-only (tools, listings,
insights) and adds only Telegram-specific pieces. See the README section
"Message chezy on Telegram" for the criteria mapping.

## How it meets the judging criteria

| Criterion | Implementation |
| --- | --- |
| Messageable from a stranger's phone | `@mastra/telegram` in polling mode — no webhook/tunnel; `TELEGRAM_ALLOWED_USER_IDS` empty so any user can DM |
| Memory | Mastra `Memory` on `@mastra/pg` (dedicated `mastra` schema): last 20 messages + working-memory template persisting budget, neighbourhoods, must-haves, red lines |
| Approval-gated actions | `arrangeViewing` never fires on its own: the agent proposes, Telegram shows an approve/deny inline keyboard, only approval dispatches (mocked via `VIEWING_MODE=mock`) |
| Proactive | Radar loop re-scores `buildFeed` per linked user and DMs fresh matches above `RADAR_MIN_SCORE`, deduped via `bot.radar_seen`; `mise run bot:radar` runs a pass on demand |
| Identity | Telegram user → Chezy user mapping in `bot` schema (`src/identity.ts`) |
| Model | Mastra model router to Nebius AI Studio via `OPENAI_COMPATIBLE_*` env |

Key files: `src/mastra.ts` (agent + memory), `src/telegram.ts` (polling channel),
`src/tools/adapt.ts` (web tools → Mastra tools), `src/radar/` (proactive loop),
`test/fake-telegram.ts` + `test/harness.ts` (fake-Telegram test suite).

## Status

- Bot live on Telegram, running in polling mode from the worktree process
  (`tsx` on `BOT_PORT` 4111). Keep the process alive through 17:30 judging.
- Handle submitted before the 12:00 deadline (per `.agents/notes/2026-09-20-hackbarna-tracks.md`).
- Safety: no `VIEWING_MODE` in the bot env → viewing dispatch is mocked; a judge tapping
  Approve cannot ring a real phone.
