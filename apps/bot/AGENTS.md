# apps/bot, `@chezy/bot`

Telegram client for chezy: a thin adapter over `apps/web/lib`, not a fork. Mastra
agent + `@mastra/telegram` polling provider + `@mastra/hono` `MastraServer`, run
with `tsx` (never `mastra dev`/`mastra build`, bundling would break the
cross-package `~/*` imports).

## Layout

- `src/index.ts`, entrypoint: loads `.env`/`.env.local`, `ensureBotSchema()`,
  Hono + `MastraServer`, `POST /internal/radar/run` (guarded by
  `BOT_INTERNAL_TOKEN`), `telegram.connect("chezy", ...)`.
- `src/env.ts`, the ONLY `process.env` reader (oxlint override). Accepts
  `TELEGRAM_BOT_TOKEN` or `TELEGRAM_BOT_API_KEY`, `TELEGRAM_BOT_USERNAME` or
  `TELEGRAM_BOT_NAME`; resolved as `env.BOT_TOKEN` / `env.BOT_USERNAME`.
- `src/mastra.ts`, `createBotStack()`: PostgresStore (schema `mastra`), Memory
  (lastMessages 20, working memory on, semantic recall off), Agent `chezy`.
- `src/telegram.ts`, `TelegramProvider` in polling mode, `toolDisplay: "cards"`
  (required for approve/deny inline keyboards), `onDirectMessage` stamps the
  resolved username into `requestContext`.
- `src/identity.ts`, `bot.telegram_users` mapping + `CREATE SCHEMA/TABLE IF NOT
  EXISTS` for `bot.*` (telegram_users, radar_seen, viewings, listing_feedback).
- `src/tools/`, `adapt.ts` strips `username` from the web tool input schema and
  injects it from `requestContext`; `arrange-viewing.ts` and
  `record-feedback.ts` are bot-local (no web tool exists; they mirror the web
  route logic against the same lib functions). `identifyUser` is NOT exposed.
- `src/radar/`, interval loop + dedupe via `bot.radar_seen`; sender tries the
  Chat SDK adapter `openDM`/`postMessage` first, falls back to raw Bot API
  `sendMessage`.
- `test/fake-telegram.ts`, in-memory Bot API (getMe, deleteWebhook, getUpdates,
  sendMessage, editMessageText, sendChatAction, answerCallbackQuery,
  setMyCommands). Note: `@mastra/telegram` sends GET when there is no payload.
  `.enqueue(update)`, `.calls`, `.sendText()`, `.callbackQuery()`.

## Rules

- Repo rules apply (Valibot not zod, no `useEffect`, no `process.env` outside
  `src/env.ts`, Conventional Commits, no Co-Authored-By).
- `apps/web` is imported read-only via the `~/*` tsconfig path. The only web
  edit is the exported `searchListingsInput` schema in
  `lib/ai/tools/search-listings.ts` (the `saveUserProfile` input schema comes
  from `@chezy/contract`).
- Tests run against the fake Telegram only, never hit api.telegram.org in
  vitest. `test/harness.ts` stubs env before importing `src/`.

## Run

```sh
mise run bot:dev     # watch mode
mise run bot:start   # single run
mise run bot:test    # fake-Telegram suite
mise run bot:radar   # POST /internal/radar/run (BOT_INTERNAL_TOKEN required)
```

Supervised (oxmgr) entry, snippet only, add to `~/.config/oxmgr/oxfile.toml`
manually if wanted:

```toml
[apps.chezy-bot]
cmd = "mise run bot:start"
dir = "~/Documents/prjcts/_own/chezy"
```
