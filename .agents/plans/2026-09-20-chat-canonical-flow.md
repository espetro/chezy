# 2026-09-20: make `/chat` the canonical demo flow

> Status 2026-09-20 10:39: Tier 0 backend + evals landed via PR #47. The /chat page was
> dropped (PR #49); the four checkpoints in docs/checkpoints/ replaced the flow doc.
> Tier 1 form-in-chat is void.
> Aligned with JES-8 (single feedback + profile store) same day.

Contract: `.agents/docs/demo-flow.md`. Demo at 11:00 CEST, delivery 12:00. This plan is
ordered by demo value; stop wherever the clock says stop, each tier is shippable.

## Why

Two products exist (`(flow)` form wizard at `/`, tool-driven chat at `/chat`) with two
profile models (`SearchProfile` table vs `User.profile` jsonb), two searchers (scored
feed vs unscored tool) and a 95% call gate that only exists in a client component. The
owner wants the four-beat chat flow. We port the scorer and the call gate into chat
tools and freeze the form wizard.

## Tier 0 (P0): beats 2, 3, 4 in chat

### Contract (`packages/contract/src/user.ts`)

Extend `userProfileSchema` with:

```ts
mustHaves: v.optional(v.array(v.string())),          // scorer keys: exterior, balcony_or_terrace, elevator, air_conditioning, furnished, pets_allowed, heating
redLines: v.optional(v.array(v.string())),           // no_interior, no_high_deposit, no_flatmates
rejectedListingIds: v.optional(v.array(v.string())),
maxCommuteMin: v.optional(v.number()),
minM2: v.optional(v.number()),
```

Add `packages/contract/src/feedback.ts`:

```ts
export const listingFeedbackInputSchema = v.object({
  username: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  listingId: v.string(),
  verdict: v.picklist(["accepted", "rejected"]),
  reason: v.optional(v.string()),
});
```

Add `packages/contract/src/viewing.ts` if `ViewingRequestSchema`/`BookingRequestSchema`
are not already there (they are exported from the package index; check `src/`).

### Adapter (`apps/web/lib/user-profile.ts`)

`toScoringProfile(profile: UserProfile): SearchProfile`: areas -> neighbourhoods,
budgetMaxEur -> maxPriceEur, budgetMinEur ?? 0 -> minPriceEur, bedroomsMin ->
minRooms, minM2 ?? 0, maxCommuteMin ?? 25, mustHaves ?? [], redLines ?? [], workLat/Lon
null (workLocation is free text; no geocode in the chat path today), the rest
defaults. Unit-tested.

### `searchListings` tool (`lib/ai/tools/search-listings.ts`)

Input gains `username` (required, like `saveUserProfile`). Execute:

1. Load the named user's profile. If missing fields, return `{ error: "onboarding
   incomplete", missingFields }`.
2. Filter = `{ neighbourhoods: profile.areas, maxPriceEur, minRooms, minM2 }` merged
   with any explicit overrides in the tool input (model can still pass `query`,
   `maxPriceEur`, `minRooms`).
3. `buildFeed(scoringProfile, listRentCandidates)` (already relaxes in order) then
   drop `rejectedListingIds`, take top 6.
4. Return `{ listings: ScoredListingSummary[], total, relaxed, note, topMatches:
   string[] }` where `ScoredListingSummary = ListingSummary & { score, reasons }` and
   `topMatches` = ids with `score >= AUTO_CALL_MATCH_THRESHOLD`.

Move `AUTO_CALL_MATCH_THRESHOLD` from `lib/flow/constants.ts` to `lib/constants.ts`
(re-export from the old location so `(flow)` keeps compiling).

Translate `lib/match.ts` reason strings and `lib/feed.ts` note to English (the chat
is English-first; MEMORY.md lists this as an open item). Update `match.test.ts` /
`feed.test.ts` expectations accordingly.

### `recordListingFeedback` tool (new, `lib/ai/tools/record-listing-feedback.ts`)

Execute: load user, append `listingId` to `rejectedListingIds` when rejected (dedupe),
then `patch = inferPreferencePatch(reason, listingRow)` (pure function in
`lib/user-profile.ts`, keyword-based, English + Spanish keywords):

| reason contains | patch |
| --- | --- |
| expensive, price, budget, caro | `budgetMaxEur = min(current, listing.priceEur - 1)` only if the listing was over budget; otherwise `budgetMaxEur = round(listing.priceEur * 0.95)` |
| far, area, zone, barrio, neighbourhood, lejos | remove `listing.neighbourhood`/`district` from `areas` if present |
| small, tiny, m2, pequeño | `minM2 = listing.builtM2 + 5` |
| elevator, ascensor | add `elevator` to `mustHaves` |
| balcony, terrace, terraza, balcón | add `balcony_or_terrace` |
| dark, interior, light, luz | add `exterior` to mustHaves and `no_interior` to redLines |
| furnished, amueblado | add `furnished` |
| pets, mascota | add `pets_allowed` |

Return `{ verdict, listingId, patch, profile }`. Unit-tested table-driven.

### `arrangeViewing` tool (new, `lib/ai/tools/arrange-viewing.ts`)

Extract the dispatch branch of `app/api/viewing/route.ts` into
`lib/viewing.ts: dispatchViewing({ propertyRef, agencyPhone?, slotHint? }):
Promise<ViewingResult>` and the booking branch of `app/api/calendar/route.ts` into
`lib/calendar.ts: bookViewing(input): Promise<BookingResult>`. Both routes become
thin wrappers. Tool execute: `dispatchViewing` -> if status !== "failed" ->
`bookViewing({ propertyRef, slotIso })` -> insert `Viewing` row -> return `{ listing:
ListingSummary, viewing: ViewingResult, booking: BookingResult, viewingId }`.

`Viewing` table (`lib/db/schema.ts` + migration, one commit): `id uuid pk`, `userId
uuid fk User`, `listingId text fk Listing`, `channel text`, `callId text`, `slotIso
text`, `status text` (dispatched | booked | failed | mock), `createdAt`, `updatedAt`.
`/api/calendar` POST additionally updates the matching `Viewing` row (by `propertyRef`
+ most recent non-booked) to `booked` when called by the SLNG webhook.

### Chat UI (`components/chat/`)

- `listing-results.tsx`: `ListingCard` gains `score`, `reasons`, `onAccept`,
  `onReject`; renders `ScoreBadge`-style pill (reuse `components/flow/ui/ScoreBadge`),
  up to 3 reasons, Accept / Reject buttons. Reject expands an inline text input
  ("why? optional") + Send. Both call `sendMessage` from the chat hook with the exact
  strings in demo-flow.md. Cards for ids in the message's later `recordListingFeedback`
  outputs render dimmed with "Rejected". English labels throughout ("View listing").
- `viewing-card.tsx` (new): renders the `arrangeViewing` output.
- `message.tsx`: wire `tool-recordListingFeedback` (compact one-line chip) and
  `tool-arrangeViewing` (ViewingCard).

### Prompt (`lib/ai/prompts.ts`)

Rewrite the "Finding homes" block + `onboardingPrompt` to follow demo-flow.md beats:
auto-search on onboarding completion, one-line acknowledgement after feedback,
re-search after 1-2 rejections, propose a viewing when `topMatches` is non-empty, call
`arrangeViewing` only after a yes or an explicit request. Pass `username` to every
profile-aware tool. Remove the Spanish example.

### Route (`app/(chat)/api/chat/route.ts`)

Register `recordListingFeedback` and `arrangeViewing` in `tools` and `activeTools`.
`stopWhen: isStepCount(5)` is enough for identify -> form -> save -> search in one turn.

### Redirect

`next.config.ts`: `/` -> `/chat` (307). Keep the `/flow/*` redirects.

## Tier 1 (P1): beat 1 form in chat

`showOnboardingForm` tool (`lib/ai/tools/show-onboarding-form.ts`): no execute
(client-rendered part), input `{ username, missingFields: string[] }`.
`components/chat/onboarding-form.tsx`: renders `RoutineStep`, `BudgetStep`,
`MustHavesStep`, `DealbreakersStep` from `components/flow/onboarding/OnboardingSteps.tsx`
in one scrollable card with a single Submit; on submit `sendMessage` the structured
line from demo-flow.md. Map `UserPreferences` -> `UserProfile` keys via the existing
`MUST_HAVE_TO_SEARCH` / `RED_LINE_TO_SEARCH` tables in `lib/flow/adapters.ts` (export
them). Prompt: call `showOnboardingForm` instead of asking field by field when
`missingFields.length >= 2`.

## Tier 2 (P2): polish

- Persisted `Viewing` list surfaced in the sidebar ("Upcoming viewings").
- `/explore` reads `User.profile` too, so the frozen surface does not rot.

## Evals (lead-authored, `apps/web/evals/`)

- `scorer.golden.test.ts`: vitest, imports `scoreListing`/`rankListings` and the
  fixtures in `evals/fixtures/`. Cases: the Jessie profile against 8 hand-written
  listings with expected bands (`>= 95`, `80-94`, `< 60`) and expected top-3 order;
  reject-list exclusion; must-have coverage monotonicity; budget tiers. Included in
  `pnpm test`.
- `tool-trace.eval.ts`: `tsx` script, hits `POST /api/chat` on a running dev server
  with the guest cookie, replays happy path A, prints the tool sequence and asserts
  the expected order + the "no arrangeViewing before topMatches or explicit ask"
  invariant. Run by hand: `mise run eval:trace`.

## Verification

- `mise run validate:quick` after each tier.
- `pnpm --filter @chezy/web test -- match feed user-profile evals` for the touched
  suites.
- Manual: happy path A in the browser on `http://localhost:4656/chat`.
- `pnpm exec playwright test tests/e2e/flow-happy-path.test.ts` is expected to keep
  passing (frozen surface, only `/` redirect changes: update its first step to
  `page.goto("/onboarding")`).

## Docs touched

`PRD.md` demo narrative points at demo-flow.md; `AGENTS.md` route map; `MEMORY.md`
product-surface section; `.agents/docs/screens/README.md` marks flow-* as frozen.
