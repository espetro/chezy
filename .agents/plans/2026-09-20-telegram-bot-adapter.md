# 2026-09-20: Telegram client as an adapter over the existing infra (Mastra challenge)

Target: the Mastra "Build an agent people can message" challenge. Judge messages the bot
cold from their phone. Scoring: works from a stranger's phone (30), more than a wrapper
(30), someone would keep it (20), craft (20).

Decision (research, 2026-09-20): Telegram, built as a **second client** in `apps/bot`,
not a pivot. The webapp keeps being the main development line; the bot must never require
moving or rewriting `apps/web` modules. It imports them.

Verified against Mastra/Chat SDK docs on 2026-09-20:

- `@mastra/telegram` `TelegramProvider` supports `mode: "polling"` (no tunnel, no public
  URL), `apiBaseUrl` override (fake Telegram for headless tests), `resolveResourceId`
  (memory identity), `handlers` overrides, `toolDisplay` default `text` on Telegram with
  approve/deny still rendered as inline keyboard cards.
- `createTool` accepts Standard JSON Schema: `toStandardJsonSchema(v.object(...))` from
  `@valibot/to-json-schema` (already a dep of `apps/web`). Zod ban holds.
- Model router accepts `{ id: "custom/<model>", url, apiKey }` for OpenAI-compatible
  endpoints. Same Nebius env vars as the webapp.
- `@mastra/hono` `MastraServer` lets us run Mastra under our own process (`tsx`), which is
  what makes cross-directory imports into `apps/web/lib` viable (no `mastra build` bundler
  in the way).
- `@chat-adapter/tests` ships mock adapter/state/message factories + Vitest matchers.

Open items to verify in Tier 0 before anything depends on them (each has a fallback):

1. Tool `execute` can read the Telegram user id (via `requestContext` set in a channel
   handler, or via `resourceId` in the tool context). Fallback: dynamic `instructions`
   that inject the resolved username into the system prompt.
2. Proactive sends work in polling mode: `telegram.getAdapter(installationId)` returns the
   Chat SDK adapter, and `adapter.openDM(userId)` / `thread.post()` deliver outside a
   handler. Fallback: raw Bot API `sendMessage` with the stored chat id (trivial, loses
   card rendering).
3. Mastra `Memory` with `@mastra/pg` `PostgresStore` accepts a dedicated Postgres schema
   (`mastra`) on pg0 so it never touches the drizzle tables. Fallback: `LibSQLStore` file
   in `apps/bot/.data/`.

## Architecture: adapter, not fork

```
apps/bot/
  package.json            @chezy/bot, private, "type": "module"
  tsconfig.json           paths: "~/*" -> ["../web/*"], "server-only" -> ["./src/shims/server-only.ts"]
  src/
    index.ts              Hono + MastraServer + TelegramProvider.connect + radar.start
    env.ts                the ONE process.env reader in apps/bot (Valibot, mirrors apps/web/lib/env.ts shape)
    mastra.ts             new Mastra({ agents: { chezy }, channels: { telegram }, storage })
    agent.ts              Agent({ id: "chezy", model: nebius(), memory, tools, instructions })
    telegram.ts           new TelegramProvider({ mode, apiBaseUrl, resolveResourceId, handlers })
    identity.ts           telegram user id -> chezy username ("tg-<id>") -> User row (createNamedUser)
    tools/
      adapt.ts            adaptTool(): AI SDK `tool()` from apps/web -> Mastra createTool
      index.ts            searchListings, saveUserProfile, recordListingFeedback, arrangeViewing (requireApproval)
    radar/
      radar.ts            interval loop: per linked user -> buildFeed -> unseen >= threshold -> DM
      seen.ts             bot.radar_seen table (CREATE IF NOT EXISTS at startup, `bot` schema)
    shims/server-only.ts  empty module
  test/
    fake-telegram.ts      Hono app: getMe, getUpdates (queue), sendMessage/editMessageText (record), answerCallbackQuery
    *.test.ts
  AGENTS.md
```

What the bot imports from `apps/web/lib` (read-only, no edits): `listings`, `feed`,
`match`, `user-profile`, `viewing`, `calendar`, `slng`, `vonage`, `insights`,
`db/queries`, `db/client`, `ai/prompts` (onboarding + system prompt text), the four
tools' `execute` bodies. Node resolves their deps (`drizzle-orm`, `postgres`, `ai`, ...)
from `apps/web/node_modules` because resolution starts at the importing file. `tsx`
honours tsconfig `paths`, so `~/*` and the `server-only` shim resolve at runtime.

The only `apps/web` edits allowed by this plan, each a one-line export with no behaviour
change (so webapp work is not disturbed):

- `lib/ai/tools/{search-listings,save-user-profile,record-listing-feedback,arrange-viewing}.ts`:
  `export const <name>Input = v.object({...})` (the schema object that is currently inline
  in `valibotSchema(...)`). `adaptTool` needs the raw Valibot schema to strip `username`
  and emit Standard JSON Schema.

### `adaptTool` contract (`apps/bot/src/tools/adapt.ts`)

```ts
interface AdaptToolOptions<TInput extends v.ObjectSchema<any, any>> {
  readonly id: string;
  readonly source: Tool<any, any>;                 // the AI SDK tool from apps/web (description + execute)
  readonly input: TInput;                          // raw Valibot object, includes `username`
  readonly requireApproval?: boolean;
  readonly description?: string;                   // override when Telegram needs shorter wording
}
// Returns createTool({ id, description, inputSchema: toStandardJsonSchema(v.omit(input, ["username"])),
//   requireApproval, execute: (args, ctx) => source.execute({ ...args, username: usernameFrom(ctx) }, aiSdkOpts) })
```

`usernameFrom(ctx)` reads the value set by `identity.ts` (open item 1). Missing username
throws a clear error; never lets the model invent one.

### Identity

- `resolveResourceId` returns `tg:<telegramUserId>` (Mastra memory resource).
- On every inbound DM, `identity.ts` calls `getUserByUsername("tg-<id>")` and
  `createNamedUser` on miss (same helpers `identifyUser` uses), stores
  `{ username, chatId, threadId }` in `bot.telegram_users` (also `CREATE IF NOT EXISTS`,
  `bot` schema) for the radar.
- The `identifyUser` tool is **not** exposed on Telegram. Instructions say the user is
  already identified.

### Agent

- Model: `{ id: "custom/" + CHEZY_MODEL_ID, url: OPENAI_COMPATIBLE_BASE_URL, apiKey }`.
- Memory: `@mastra/pg` `PostgresStore` (schema `mastra`), `lastMessages: 20`,
  `workingMemory: { enabled: true, template: <budget, neighbourhoods, rooms, must-haves,
  red lines> }`, semantic recall **off** (no embedder wiring needed). Memory criterion is
  satisfied by working memory surviving across days; the webapp's `Memory` table is not
  shared, and that's fine.
- Instructions: English. Reuse the intent of `lib/ai/prompts.ts` onboarding + system
  prompt, rewritten for Telegram: short messages, no markdown tables, one question at a
  time during onboarding, never call `arrangeViewing` without the user asking for a visit,
  handle off-topic gracefully (the 30-point "message it wasn't built for" test).
- Tools: `searchListings`, `saveUserProfile`, `recordListingFeedback`,
  `arrangeViewing` (`requireApproval: true`, approval card text must state the listing
  and that a phone call to the agency will be placed).

### Radar (message first)

- `RADAR_INTERVAL_MS` (default 15 min, `1 min` in demo), `RADAR_MIN_SCORE` (reuse
  `AUTO_CALL_MATCH_THRESHOLD` from `lib/constants.ts` as default).
- Loop: for each row in `bot.telegram_users` whose profile passes `missingProfileFields`
  → `buildFeed(scoringProfile)` → filter `score >= RADAR_MIN_SCORE` and id not in
  `bot.radar_seen(username, listing_id)` → post at most 1 message with up to 3 listings
  (title, price, neighbourhood, score, link) ending with "Want me to call the agency for
  any of these?" → insert seen rows. Idempotent by construction.
- Demo trigger: `POST /internal/radar/run` (Hono route, `BOT_INTERNAL_TOKEN` header) so a
  demo or an agent can fire it on request; plus `mise run bot:radar` calling it.

### Safety for judging

- `VIEWING_MODE=mock` and `CALENDAR_MODE=mock` in the deployed env, or
  `DEMO_AGENCY_PHONE` set to a number we own. A judge tapping Approve must never ring a
  real agency.
- `TELEGRAM_ALLOWED_USER_IDS` stays empty (judge is a stranger). Chat SDK dedupe handles
  Telegram redelivery.

## Tiers

Each tier ends shippable. Stop where the clock says stop.

### Tier 0: skeleton that answers on Telegram (est. 3h)

- `apps/bot` package, `tsconfig` paths, `env.ts`, `shims/server-only.ts`.
- `agent.ts` with Nebius model, no tools, no memory. `index.ts` with `MastraServer` on
  `BOT_PORT` (default 4111) and `TelegramProvider({ mode: "polling" }).connect("chezy",
  { botToken })`.
- BotFather: create bot, `TELEGRAM_BOT_TOKEN` in `apps/bot/.env.local`, `.env.example`
  committed.
- `test/fake-telegram.ts` + first e2e test: enqueue a `message` update, assert the fake
  recorded a `sendMessage` for that chat. Runs in vitest with `TELEGRAM_API_BASE_URL`
  pointed at the fake; no network.
- Resolve open items 1 and 3 here (tiny spikes, both with fallbacks).
- Done when: a message from a real phone gets a coherent reply, and the fake-Telegram
  test is green.

### Tier 1: chezy brain (est. 4h)

- `identity.ts`, `bot.telegram_users`.
- `adaptTool` + the four tools. One-line `*Input` exports in `apps/web` tool files.
- Memory (`@mastra/pg`, schema `mastra`, working memory template).
- Instructions rewritten for Telegram; onboarding conversational.
- Tests: `adaptTool` strips `username` and injects it (unit, `@chat-adapter/tests` not
  needed); approval flow e2e on fake Telegram: user asks for a visit → fake records a
  message with an inline keyboard → enqueue the `callback_query` for approve → assert
  `dispatchViewing` mock was called and a `Viewing` row exists (pg0 test DB).
- Done when: onboarding → search → feedback → approve-gated viewing works from the phone
  with `VIEWING_MODE=mock`, and working memory survives a bot restart.

### Tier 2: radar (est. 3h)

- `bot.radar_seen`, `radar.ts`, `/internal/radar/run`, `mise run bot:radar`.
- Resolve open item 2.
- Test: seed a user + profile, run radar once against the fake → assert one `sendMessage`
  with N listings and N `radar_seen` rows; run again → assert no send.
- Done when: a new seeded listing produces a DM within one interval without the user
  writing first.

### Tier 3: run it and document it (est. 2h)

- oxmgr app entry (`chezy-bot`, `pnpm --filter @chezy/bot start`) on this machine or the
  Mac mini; pg0 reachable via `POSTGRES_URL`. Polling means no inbound port.
- `apps/bot/AGENTS.md`, root `AGENTS.md` layout line, `.oxlintrc.json` override adding
  `apps/bot/src/env.ts` to the `process.env` allowlist, `mise.toml` tasks `bot:dev`,
  `bot:start`, `bot:test`, `bot:radar`.
- README section for the challenge: what it does, bot handle, how the four criteria map
  (memory, approval, radar), how to run locally with the fake Telegram.
- `.agents/notes/2026-09-20.md` entry with surprises (which fallbacks were needed).

## Testing ladder (what an agent runs, in order)

1. `pnpm --filter @chezy/bot test`: unit + fake-Telegram e2e, no tokens, no network,
   pg0 running (`mise run db:start`).
2. `curl -N localhost:4111/api/agents/chezy/stream -d '{"messages":[...]}'`: agent +
   memory + tools without Telegram at all.
3. `mise run bot:dev` with a real token, polling: message from own phone. Last step only.

## Explicit non-goals

- No change to `apps/web` chat UI, routes, or the `(flow)` screens.
- No extraction of `apps/web/lib` into `packages/*`. If the bot proves the modules are
  shared for good, that's a later, separate plan.
- No Discord/Slack. Telegram only.
- No semantic recall in Mastra memory (would need an embedder and a second vector table).
- No webhook mode, no cloudflared.

## Project tracking

No GitHub Project exists for `espetro/chezy` (checked `gh project list` for `espetro` and
`calohco` on 2026-09-20). Per repo policy this plan needs a refined task (iteration,
effort, dates, label). Effort estimate: **L** (12h across tiers, 4 contact surfaces:
Telegram API, Mastra memory/pg, apps/web tool bodies, oxmgr deploy). Label: `feature`.
Owner to create the Project and record its URL in `AGENTS.md`; until then this plan is
the tracking artefact.
