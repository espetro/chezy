# Listing insights: VLM extraction over listing photos

Goal: turn each listing's photo set into structured, filterable facts
(condition, flooring, windows, light, outdoor, trust flags) plus a short
Spanish narrative, stored in Postgres and exposed to the chat assistant and
the SLNG phone agent.

## Model probe results (verified 2026-09-19)

Nebius (`api.studio.nebius.com/v1`) vision-capable models:

- `moonshotai/Kimi-K3` — best. MUST be called with
  `chat_template_kwargs: {"thinking": false}` (otherwise it burns the whole
  token budget on reasoning and returns empty content), `max_tokens >= 4000`,
  `temperature 0`. Wraps JSON in ```json fences — strip before parsing.
- `moonshotai/Kimi-K2.6`, `google/gemma-3-27b-it` (cheap fallback),
  `openbmb/MiniCPM-V-4_5` also accept images.
- Qwen3.5 / GLM variants reject images.
- ~25 photos ≈ 43k prompt tokens via CDN `?rule=original` URLs; local WebPs
  (`chezy-mock-data/media/...`, ≤1280px) sent as base64 data URLs are cheaper —
  local first, CDN fallback.

Photos per listing: avg 22, max 25 (`media[]` kind == "photo"; video/tour_3d
skipped). 71% of source `room_type` is null — `per_image` output backfills it.
No floor plans exist in the dataset.

## Schema rationale

`ListingInsight` keeps the full insights JSON (Tier 2 trust flags + Spanish
narrative) and flattens Tier-1 filterable facts into columns
(`conditionScore`, `flooringDominant`, `windowSize`, `lightNatural`, `facing`,
`outdoorSpaces`, `furnished`, `style`, `acVisible`, `virtualStaging`) so
`searchListings` can later filter on them without jsonb scans.

## Design

- `ensureListingInsights(listingId)` — returns the stored row when
  `promptVersion === INSIGHTS_PROMPT_VERSION` (unless `force`), else extracts,
  upserts, and backfills `listing.media[].roomType` where null. Bump
  `INSIGHTS_PROMPT_VERSION` to invalidate all stored rows.
- Extraction calls Nebius `/chat/completions` directly (raw `fetch`) because
  `chat_template_kwargs` and raw usage aren't reachable through the AI SDK.
- `mise run listings:enrich` batch-enriches with `--limit/--force/--concurrency/--model`.

## Commits

1. `feat(vision)` — prompt, Valibot schema, extract module, env vars, tests.
2. `feat(db)` — `ListingInsight` table, `lib/insights.ts`, enrich script.
3. `feat(chat)` — insights in `getListing`/`getListingInsights` tools and
   `/api/viewing` call variables (`property_highlights`, `property_condition`).

## Follow-ups

- Wire flattened columns into `searchListings` filters once the relaxation
  ladder lands.
- Eval sample: 15 hand-labelled listings vs VLM output.
- Floor-plan branch (`room_type: "plan"`) when plans exist in the data.
