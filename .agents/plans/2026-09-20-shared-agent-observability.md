# 2026-09-20: bot conforms to web; scores, audit, hybrid match, grounding evals

Follow-up to `2026-09-20-telegram-bot-adapter.md` (PR #53). Supersedes the first draft of
this plan (shared `packages/agent`, Mastra memory for web history): the owner chose the
**conservative topology** on 2026-09-20 to avoid disrupting teammates working on `apps/web`.

## Principle

`apps/web` is the reference implementation. The Telegram bot is a consumer of web's
modules and conforms to whatever web uses: web's AI SDK tools (through `adaptTool`), web's
scorer (`lib/match.ts` + `lib/feed.ts`), web's prompts, web's audit vocabulary, web's
Postgres. Every change to `apps/web` in this plan is **additive** (new file, new column,
new lines inside an existing function) and lands in small commits that rebase cleanly on
whatever teammates are doing. No module moves, no route rewrites, no schema drops, no
change to the chat UI transport.

Shared logic that both surfaces need lives in `apps/web/lib` (where the bot already reads
it via the `~/*` alias), never in the bot. If it is pure and small, it is a new file there.

Prerequisites: PR #47 (`chat-canonical-flow`: scored `searchListings`, `recordListingFeedback`,
`arrangeViewing`, `lib/viewing.ts`) and PR #53 (bot) merged. The bot then runs from `main`.

Timing: **start now, ship live**. Each PR redeploys `@hackbarna_chezybot` after the
fake-Telegram suite passes (procedure at the end). PR 1 is the only one that changes the
bot's conversational behaviour during judging; PR 3 changes ranking, so it lands after
17:30 unless ready by 15:00.

## PR 1: bot conforms to #47 and shows the score (item 1)

Bot only, plus one additive web export.

- Delete `apps/bot/src/tools/arrange-viewing.ts` and `record-feedback.ts`. Adapt web's
  `arrangeViewing` (with `requireApproval: true`) and `recordListingFeedback` through
  `adaptTool`, like `searchListings` and `saveUserProfile`. Web's `arrangeViewing`
  persists to the `Viewing` table, so `bot.viewings` and `bot.listing_feedback` are
  dropped (`ensureBotSchema` stops creating them; a `DROP TABLE IF EXISTS` for the two
  runs once at startup behind a comment).
- `searchListings` on Telegram now returns #47's shape: `listings[].score`,
  `listings[].reasons`, `topMatches`. Instructions: each card shows `match N/100 · <first
  reason>`; if `topMatches` is non-empty, offer the viewing for those explicitly.
- Web export needed: `export const recordListingFeedbackInput` / `arrangeViewingInput`
  in the two #47 tool files (same one-line hoist as `searchListingsInput`).
- Instructions stay bot-local (`apps/bot/src/instructions.ts`) but the onboarding and
  search rules are copied from `lib/ai/prompts.ts` text so both surfaces say the same
  things; a comment names the source section. Web prompts are not touched.
- Tests: adapt.test unchanged; approval e2e asserts a `Viewing` row (web table) instead of
  `bot.viewings`; radar test unchanged.

## PR 2: structured audit per turn on both surfaces (item 2)

Web already emits `chat.turn.start` / `chat.turn.complete` / `chat.turn.fail` via
`createAuditLogger("chat")` in `app/(chat)/api/chat/route.ts` with `ctx: { model,
messageCount }`. Extend, don't replace.

- New pure file `apps/web/lib/ai/turn-audit.ts`:

  ```ts
  export interface TurnAudit {
    channel: "web" | "telegram";
    model: string;
    latency_ms: number;
    tools: Array<{ name: string; ok: boolean; listingIds?: string[] }>;  // ids only
    cited_listing_ids: string[];        // listing ids/urls found in the assistant text
    grounding?: { score: number; ungrounded: string[] };                // PR 4
  }
  export function summarizeTurn(input: { channel; model; startedAt; steps: ModelMessage[] | UIMessagePart[]; assistantText: string }): TurnAudit
  export function extractListingRefs(text: string): string[]          // idealista urls, listing ids
  export function listingIdsFromToolResult(name: string, result: unknown): string[]
  ```

  No message bodies, no prompts (observability package rule).
- Web route: in the existing `chat.turn.complete` emit, `ctx: { ...summarizeTurn(...),
  messageCount }`. Three lines changed inside one call, nothing else in the route.
- Bot: `apps/bot/src/observability/audit-exporter.ts` implements Mastra's
  `ObservabilityExporter` (`@mastra/observability`), listens to `span_ended` on the root
  `AGENT_RUN` span, collects child `TOOL_CALL` spans, calls the same `summarizeTurn` and
  emits `chat.turn.complete` / `chat.turn.fail` through `createAuditLogger("chat")` with
  `actor = chezy userId`, `target = threadId`, `channel: "telegram"`. Same file, same
  vocabulary, `jq 'select(.channel=="telegram")'` splits them. `configureLogger({
  service: "chezy-bot" })` at bot boot (the JSONL file is per service, same dir).
- `mise run audit:turns -- [date]`: `jq` one-liner over `.audit/chezy-{web,bot}-<date>.jsonl`
  printing channel, tools, cited ids, grounding score.

Verify first (open item 2a): the exporter sees `TOOL_CALL` span `output` and the request
context on the root span (`requestContextKeys: ["chezy.username"]`). Fallback: emit from
the channel `onDirectMessage` wrapper using `agent.stream` `onFinish`.

Tests: `turn-audit.test.ts` (ref extraction, tool id extraction, shape); exporter unit test
with synthetic spans asserting one JSONL line.

## PR 3: hybrid match score, deterministic + embedding cosine (item 3, first half)

All in `apps/web/lib`, additive, both surfaces benefit through `buildFeed`.

- Migration (web `db:generate`): table `ListingEmbedding` (`listingId` fk → `Listing`,
  `embedding vector(4096)`, `embeddingModel`, `textHash`, `createdAt`) reusing the
  existing `vector` custom type from `lib/db/schema.ts`; column
  `SearchProfile.freeformEmbedding vector(4096)` + `freeformTextHash` for the cached
  profile vector. No index at 320 rows (note for scraper scale-up: `hnsw` with
  `vector_cosine_ops`).
- `scripts/embed-listings.ts` + `mise run listings:embed`: text = title + description +
  amenity labels + neighbourhood; `embedText()` (existing, Nebius
  `Qwen/Qwen3-Embedding-8B`); idempotent on `textHash`. Run once; rerun after scraping.
- `lib/match.ts`: `scoreListing()` untouched. New exported `hybridScore(det: MatchResult,
  cosine?: number): MatchResult`:

  ```ts
  semantic = cosine === undefined ? undefined
           : round(100 * clamp01((cosine - SEMANTIC_FLOOR) / (SEMANTIC_CEIL - SEMANTIC_FLOOR)));
  score = det.score === 0 || semantic === undefined ? det.score
        : round((1 - HYBRID_SEMANTIC_WEIGHT) * det.score + HYBRID_SEMANTIC_WEIGHT * semantic);
  ```

  Gates stay gates: a deterministic 0 (over budget, red line) is never rescued.
  `MatchResult` gains optional `breakdown: { deterministic; semantic? }` and one reason
  `"matches your notes: <first freeform item>"` when `semantic >= 70`. Constants in
  `lib/constants.ts` with the governing comment: `HYBRID_SEMANTIC_WEIGHT = 0.3`,
  `SEMANTIC_FLOOR = 0.35`, `SEMANTIC_CEIL = 0.75` (calibrate on the golden set and record
  the observed cosine range in the session note).
- `lib/feed.ts` `buildFeed`: when the profile has freeform text, embed it (cache by hash),
  fetch `1 - (embedding <=> $1)` for the candidate ids in one query, apply `hybridScore`.
  Listings without an embedding stay deterministic-only. Profile text =
  `freeformRequirements` + must-have labels + `"avoid: " + red-line labels`.
- Web UI: `listing-results.tsx` already renders `score` and `reasons`; the breakdown is
  available for `MatchExplanation` later, no UI change in this PR.
- Tests: `scorer.golden.test.ts` keeps its invariants with embeddings stubbed to
  `undefined`; new golden case: two listings tied deterministically, freeform "tranquilo y
  con mucha luz" ranks the one whose description says so; `hybridScore` unit tests (no
  embedding, gate zero, clamp both ends).

## PR 4: grounding check as a Mastra scorer + web parity (item 3, second half)

- Pure function first, in web so both use it: `apps/web/lib/ai/grounding.ts`
  `scoreGrounding({ cited, returned }): { score: number; ungrounded: string[] }` where
  `score = cited.length === 0 ? 1 : grounded / cited.length`; refs are listing ids, listing
  urls, and `N €` prices matched against tool results of `searchListings` / `getListing`.
- Web: in the `chat.turn.complete` emit, `grounding: scoreGrounding(...)` computed from
  the finished messages (tool parts + assistant text). Emit `chat.grounding.low`
  (`outcome: "failure"`, auto-warn) when `score < 1`. Additive lines in the same block PR 2
  touched.
- Bot: `apps/bot/src/scorers/grounding.ts` = `createScorer({ id: "grounding", type:
  "agent" })` with function steps only (no judge LLM): `preprocess` builds `cited` from the
  assistant text and `returned` from tool results in `run.output`, `generateScore` calls
  `scoreGrounding`, `generateReason` lists `ungrounded`. Registered on the agent with
  `sampling: { type: "ratio", rate: 1 }`; scores persist in Mastra storage (`mastra`
  schema). The audit exporter's `onScoreEvent` folds the score into the turn record and
  emits `chat.grounding.low` like web does.
- `mise run agent:scores`: last 50 grounding scores with reasons from Mastra storage.

Verify first (open item 4a): agent-type scorer `run.output` includes tool result parts.
Fallback: the exporter computes grounding from `TOOL_CALL` span outputs + final text and
skips the scorer registration.

Tests: `grounding.test.ts` (all grounded → 1; one invented url → 0.5; nothing cited → 1;
misquoted price → ungrounded); scorer unit test with a synthetic run.

## What this plan deliberately does not do

- No `packages/domain` extraction; the bot keeps the `~/*` alias and `server-only` shim
  into `apps/web`. Revisit when web development calms down.
- No change to web's chat transport, history tables, memory table, or template tools.
- No Mastra on the web side. Web keeps AI SDK `streamText`; parity is achieved by sharing
  pure functions (`turn-audit.ts`, `grounding.ts`, `match.ts`) and the audit vocabulary.
- Memory stays split: web `Memory` table for web users, Mastra working memory for
  Telegram users. Identities are not linked across surfaces (guest web users have no
  Telegram id), so nothing is lost today.

## Ship-live procedure (per PR)

1. `mise run validate` green; `pnpm --filter @chezy/bot test` green; bot boot against the
   fake Telegram green.
2. Merge to `main`; in the deploy checkout `git pull && pnpm install`.
3. `kill $(lsof -tiTCP:4111 -sTCP:LISTEN)`; wait for the port; `nohup pnpm --filter
   @chezy/bot start > /tmp/chezy-bot-live-judging.log 2>&1 &`; confirm `telegram connected
   (polling)` within 30 s.
4. One DM from the owner's phone ("hola", one search). Roll back to the previous commit on
   error.

The deploy checkout is the `#53` worktree until #47 and #53 are merged, then `main`. The
bifrost LLM env lives in the gitignored `apps/bot/.env` and must be copied to the new
checkout.

## Open items

- 2a: Mastra exporter receives `TOOL_CALL` outputs and root-span request context.
- 3a: observed cosine range on the 320 listings vs the Jessie profile (sets FLOOR/CEIL).
- 4a: agent-type scorer run carries tool result parts.
- Package ages: `@mastra/observability` 1.17.8 and `@mastra/evals` 1.10.2 were published
  2026-09-15 (5 days). Pin the newest release on or before 2026-09-13 if one exists in the
  compatible range; otherwise take these and note it.

## Status at code delivery (2026-09-20 ~13:30 CEST)

- PR 1 merged as #75 (bot conforms to web tools, match score on cards). Live bot redeployed
  from `main` at that point (`~/.worktrees/chezy-0/deploy`, port 4111, polling).
- PR 2 merged as #79 (per-turn audit on both surfaces, `mise run audit:turns`). Not yet
  redeployed to the live bot; next restart picks it up.
- PR 3 (hybrid match) and PR 4 (grounding scorer): not started. Specs above are current.
- Post-delivery follow-ups: approval resume runs audit as `telegram:unknown`; `wt:init`
  script is untracked on main (worktrees were initialised by hand).
