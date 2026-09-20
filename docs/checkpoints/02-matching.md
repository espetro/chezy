# Checkpoint 2: Matching

**Outcome:** chezy scores the property DB against the stored profile, shows the top
matches as cards, asks which ones the user likes, learns from rejections, and names
the one or two matches worth booking.

Owner: (fill in)

## Entry state

Checkpoint 1 exit state: `User.profile` complete.

## Exit state (definition of done)

- The agent searches without being asked and shows at most 6 cards, each with a
  score (0-100), 2-3 reasons in English, price, rooms, m², area, photo.
- The user can accept or reject a card, with an optional reason. A rejection removes
  that listing from future results and, when the reason maps to a preference (price,
  area, size, elevator, balcony, interior, furnished, pets), patches the profile. The
  agent acknowledges what changed in one line.
- After a rejection the agent searches again in the same turn.
- Listings at or above `AUTO_CALL_MATCH_THRESHOLD` (95, `apps/web/lib/constants.ts`)
  are flagged as `topMatches`. When there is at least one, the agent names it and asks
  whether to arrange a visit. It never books on its own.

## Contract with checkpoint 3

Hands over a `listingId` (`platform:platform_id`, e.g. `fotocasa:190866104`) chosen by
the user, plus the username. Nothing else.

## Where the code lives

- Scorer: `apps/web/lib/match.ts` (`scoreListing`, `rankListings`; weights budget 30,
  barrio 25/15, must-haves 25, rooms 10, m² 10; `no_interior` red line filters before
  scoring).
- Candidate query + relaxation: `apps/web/lib/listings.ts` (`listRentCandidates`),
  `apps/web/lib/feed.ts` (`buildFeed`, relaxes minM2, neighbourhoods, price, rooms in
  that order until 8 candidates).
- Chat tools: `apps/web/lib/ai/tools/search-listings.ts` (scored, with `topMatches`),
  `record-listing-feedback.ts` (PR #47). Profile adapter `toScoringProfile` and
  `inferPreferencePatch` in `apps/web/lib/user-profile.ts` (PR #47).
- Cards: `apps/web/components/chat/listing-results.tsx` (accept/reject, PR #47);
  `components/flow/explore/CandidateCard.tsx` and `components/flow/ui/ScoreBadge.tsx`
  are the frozen-surface equivalents and reusable.
- Photo-derived insights (the "forensic" beat): `apps/web/lib/insights.ts`,
  `lib/vision/*`, tool `get-listing-insights.ts`, table `ListingInsight`.

## The data constraint (read before picking a demo brief)

Measured 2026-09-20 on the seeded rent set (150 rows):

- Only 42 rows at or under 2,070 EUR; 18 of those have 2+ rooms; 2 of those are in
  Gràcia or Eixample; 0 of those carry the `exterior` amenity.
- The cheapest 2-bed with elevator + balcony/terrace + exterior: 2,300 in Poblenou
  (`fotocasa:190866104`), 2,400 in Eixample (`fotocasa:190451552`).
- 50 rows have no district and 52 no neighbourhood; area matching misses them.

So the PRD line "Gràcia under 1,800" produces zero cards after the red line. The demo
persona is **Eixample + Poblenou, 2,400 EUR, 2 beds, elevator + balcony/terrace, no
interior** (`apps/web/evals/fixtures/jessie.ts`, PR #47). It yields exactly two 100%
matches, then 75, 75, 63. Change the persona there and in the recording together.

## Mock / real

LLM only. The DB is local pg0.

## Verification

- `pnpm exec vitest run lib/match.test.ts lib/feed.test.ts` (unit).
- `pnpm exec vitest run evals/scorer.golden.test.ts` (PR #47): the persona against 8
  hand-written listings with expected score bands; one documented known gap (a 1-bed
  can tie a 2-bed because rooms weigh 10 pts).
- `mise run eval:trace` (PR #47): asserts scored results, feedback recorded, re-search
  after rejection, no booking before the user is asked.

## Recording (video ids `shortlist` and `forensic`)

- `shortlist`, about 16 s. Must show: the request or the auto-search kicking in, the
  cards with scores, at least one accept/reject interaction and the agent's one-line
  acknowledgement.
- `forensic`, about 28 s. Must show: one amber insight card (interior lightwell / over
  the barrio average) and one green pass. Needs `ListingInsight` rows for the two
  listings shown (`mise run` the enrich script or `getListingInsights` once
  beforehand); check `apps/web/scripts/enrich-listings.ts`.
- End on the agent asking "want me to arrange a visit for <id>?".

## Open

- The `forensic` beat depends on vision insights existing for the demo listings.
  Confirm the two 100% matches have `ListingInsight` rows, or pick ones that do.
- Barrio averages (price vs average) are not computed anywhere yet; the video copy
  claims them. Either compute a per-district median from the seed data or drop the
  claim from the narration.
