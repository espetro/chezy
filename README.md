<p align="center">
  <img src="assets/logo/chezy-logo-256.png" width="128" alt="chezy logo: a terracotta house with a mint chat bubble" />
</p>

<h1 align="center">chezy</h1>

<p align="center">
  <strong>Finding a flat, made easy.</strong><br/>
  The AI rental concierge that reads listings like a local, spots the traps, and calls the agency for you.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/hackathon-Barcelona%20Sept%202026-CA6A49" alt="Hackathon, Barcelona, September 2026" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/LLM-Nebius%20AI%20Studio-93C8AE" alt="Nebius AI Studio" />
  <img src="https://img.shields.io/badge/voice-SLNG%20%2B%20Vonage-CA6A49" alt="SLNG and Vonage voice" />
  <img src="https://img.shields.io/badge/db-pg0%20(Postgres%2018)-336791?logo=postgresql&logoColor=white" alt="pg0, Postgres 18" />
</p>

You describe the flat you want in a chat. chezy searches real Barcelona listings, checks
each one forensically (does "luminoso" mean sunlight or a 1.5 m lightwell? is the price
above the barrio average?), and when you approve one it phones the agency in Spanish,
discloses that it is an AI assistant, agrees a viewing slot, and drops the confirmed
viewing on your calendar.

The listing works for the agency. chezy works for the renter.

## Quick start

### With your coding agent

Using Claude Code, Cursor, Devin or another agent? Paste this:

```text
Clone https://github.com/espetro/chezy and set it up: run `mise trust`, copy
apps/web/.env.example to apps/web/.env.local and fill in OPENAI_COMPATIBLE_API_KEY with
my Nebius key (leave VIEWING_MODE and CALENDAR_MODE on "mock"), then run `mise run setup`
and `mise run dev`. Open http://localhost:3000, complete the onboarding, and confirm that
listing cards render for "a bright 2-bed in Gracia under 1800".
```

### By hand

You need [mise](https://mise.jdx.dev) on your PATH and your keys in `apps/web/.env.local`
(start from [`apps/web/.env.example`](apps/web/.env.example)). Everything else is pinned
and installed for you.

```bash
mise trust          # install node, pnpm, python, uv, pg0 at the pinned versions
mise run setup      # pnpm install, uv sync, start pg0, migrate, seed 300 listings
mise run dev        # http://localhost:3000
```

Only `OPENAI_COMPATIBLE_API_KEY` is required for the chat. `VIEWING_MODE=mock` and
`CALENDAR_MODE=mock` keep the call and the calendar deterministic; switch them to
`slng`/`vonage` and `google` once you have those credentials.

## What happens in a session

| Beat | What you see |
|:-----|:-------------|
| **Brief** | "Find me a bright 2-bed in Gracia under 1,800." Onboarding fills the missing pieces (areas, budget, bedrooms) conversationally. |
| **Shortlist** | Real Barcelona listings, ranked against your profile, rendered as cards inside the chat. |
| **Forensic check** | One card carries an amber flag: 0% direct sunlight, windows onto a lightwell, 13% over the barrio average. Another passes. |
| **Approval** | You like the passing one and tap "call the agency". |
| **The call** | A voice agent dials the agency, speaks Spanish, opens with the AI disclosure, and agrees a slot. |
| **Booked** | The slot lands on your Google Calendar and the chat confirms the time. |

Rejections are remembered: tell it why a flat is out and the next round reranks.

## Why

Two facts about renting in Barcelona compound each other:

- **Listings lie.** In Q1 2026 asking rents on idealista averaged about 20 EUR/m² while
  registered contracts averaged 16.89 EUR/m²
  ([INCASOL via Spanish Property Insight](https://www.spanishpropertyinsight.com/2026/08/19/barcelona-rent-controls-rents-rise-while-rental-opportunities-remain-scarce/)).
- **Speed decides.** 36% of Barcelona flats rented through idealista in Q2 2026 were gone
  in under 24 hours, versus 17% nationally
  ([idealista/data](https://www.idealista.com/news/inmobiliario/vivienda/2026/08/13/909818-el-17-de-los-alquileres-de-viviendas-en-el-segundo-trimestre-se-concreto-en-apenas)).

If you are new in town, do not know barrio price norms, cannot read a lightwell from the
photos, and cannot call agencies in Spanish during your workday, every step of the funnel
is stacked against you. chezy is the agent on your side of the table.

## Message chezy on Telegram

Bot handle: [@hackbarna_chezybot](https://t.me/hackbarna_chezybot). Open the link on
your phone, say hi, and it onboards you in chat (areas, budget, bedrooms), then
searches Barcelona rentals and offers to call the agency for a viewing (approval
card first). Built on Mastra (`@mastra/core`, model router to Nebius AI Studio,
Telegram via Mastra Channels) for the HackBarna 2026 Mastra challenge.

`apps/bot` (`@chezy/bot`) is a second client for the same concierge: a Mastra
agent reachable from Telegram, running alongside `apps/web` and reusing its
tools, listings and Postgres store. It is an adapter, not a fork: the bot imports
`apps/web/lib` read-only and adds only Telegram-specific pieces (identity
mapping, approval cards, radar alerts) in a `bot` Postgres schema.

How it maps to the "build an agent people can message" criteria:

- **Works from a stranger's phone**: polling mode, no webhook or tunnel needed.
  Any Telegram user can DM the bot; `TELEGRAM_ALLOWED_USER_IDS` stays empty.
- **Memory**: Mastra `Memory` on `@mastra/pg` (dedicated `mastra` schema), 20
  last messages plus a working-memory template that persists budget,
  neighbourhoods, must-haves and red lines across sessions.
- **Approval-gated actions**: `arrangeViewing` never runs on its own. The agent
  proposes, Telegram shows an approve/deny inline keyboard, and only approval
  dispatches the call (mocked with `VIEWING_MODE=mock`).
- **Proactive**: a radar loop re-scores `buildFeed` for every linked Telegram
  user and DMs fresh matches above `RADAR_MIN_SCORE`, deduped via
  `bot.radar_seen`. `mise run bot:radar` triggers a pass on demand.

Run it locally:

```sh
cp apps/bot/.env.example apps/bot/.env   # add TELEGRAM_BOT_API_KEY + TELEGRAM_BOT_NAME
mise run db:start
mise run bot:dev
```

Headless verification uses `apps/bot/test/fake-telegram.ts`, an in-memory Bot
API server: `mise run bot:test` covers a plain DM, the approval-gated viewing
flow and radar dedupe with no network.

## Built with

<p>
  <img src="apps/video/public/badges/nebius.png" height="28" alt="Nebius AI Studio" valign="middle" />&nbsp;&nbsp;
  <img src="apps/video/public/badges/slng.png" height="28" alt="SLNG" valign="middle" />&nbsp;&nbsp;
  <img src="apps/video/public/badges/vonage.png" height="28" alt="Vonage" valign="middle" />&nbsp;&nbsp;
  <img src="apps/video/public/badges/galtea.png" height="28" alt="Galtea" valign="middle" />&nbsp;&nbsp;
  <img src="apps/video/public/badges/qualityclouds.png" height="28" alt="QualityClouds" valign="middle" />
</p>

| Layer | Choice |
|:------|:-------|
| App | Next.js 16, React 19, AI SDK 7, shadcn/ui, Tailwind 4 |
| LLM | Nebius AI Studio through `@ai-sdk/openai-compatible` (DeepSeek-V4.1-Flash by default) |
| Voice | SLNG managed agent on LiveKit SIP, Vonage Voice API for the PSTN leg |
| Data | Drizzle + postgres-js on pg0 (embedded Postgres 18 + pgvector), 300 committed Barcelona listings |
| Calendar | Google Calendar via service account |
| Scraper | uv-managed Python CLI (httpx, parsel, pydantic) with fotocasa, habitaclia, idealista and milanuncios adapters |
| Evals | Galtea and QualityClouds runs against the concierge |

## Repo map

```
apps/web         the product: chat, onboarding, explore, viewing + calendar routes
apps/bot         Telegram client (Mastra + polling adapter), second surface for the concierge
apps/scraper     listings pipeline and the committed dataset builder
apps/video       Remotion demo video
packages/*       contract (Valibot), db (Drizzle), config, ui, observability
chezy-mock-data  the 300-listing Barcelona snapshot (JSONL + Parquet)
assets/          brand: logo at every size, Outfit and DM Sans fonts
```

## Docs

- [PRD.md](PRD.md): problem, demo narrative, goals, scope, hackathon tracks
- [AGENTS.md](AGENTS.md): enforced gates and conventions for humans and agents
- [assets/README.md](assets/README.md): brand assets and how to load them
- [apps/web/README.md](apps/web/README.md), [apps/scraper/README.md](apps/scraper/README.md), [apps/video/README.md](apps/video/README.md)

## Status

Hackathon build, September 2026. The closed loop (brief to booked viewing) runs on the
committed dataset with mock voice and calendar; the live SLNG call and the evaluation
runs are in flight. Not production software: Barcelona only, single user, no real auth.
