# Screen: explore candidates feed (`/explore`, formerly `/flow/explore`)

Client component (`ExploreFeed`) rendering an agent status banner, a zone-filter chip row
+ sort dropdown, and a responsive grid of `CandidateCard`s over real listings. The server
page (`apps/web/app/(flow)/explore/page.tsx`) loads `buildFeed(profile)` — redirecting to
`/onboarding` when no `SearchProfile` exists — and maps rows through
`lib/flow/adapters.ts`'s `toFlowListing`. No pagination, no live updates — filtering and
sorting are client-side `.filter()`/`.sort()` over the feed.

## ASCII mockup

```
+------------------------------------------------------------------+
| (•)  I found 5 candidates that match your search across our      |
|      partner agency network. Sorted by match — I'll let you know |
|      as soon as a new one comes in.                              |
+------------------------------------------------------------------+
[ All neighborhoods* ][ Gràcia ][ Eixample ][ Poble Sec ] ...
                                              Sort by [ Best match v]
+------------------+  +------------------+  +------------------+
| [====photo====]   |  | [====photo====]   |  | [====photo====]   |
| 96% match          |  | 88% match          |  | 81% match          |
| Bright apartment    |  | Renovated studio    |  | Apartment with     |
| with balcony        |  | next to Sagrada..   |  | terrace near..     |
| Gràcia, Barcelona   |  | Eixample, Barcelona |  | Poble Sec, Barc.   |
|  62 m² · 2 bd       |  |  45 m² · 1 bd       |  |  70 m² · 2 bd       |
| €1050  /month       |  | €980  /month        |  | €1100  /month       |
| [ Within budget ]   |  | [ Within budget ]   |  | [ At budget limit ] |
| Exterior-facing     |  | Furnished           |  | Terrace             |
| Elevator Renovated  |  | Bills incl. Elev.   |  | Exterior-facing     |
+------------------+  +------------------+  | Pets allowed        |
                                              +------------------+
```

^ `grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1`. Score badge overlays the photo,
top-left. Card is a `<Link>` to `/explore/[id]` (id is `encodeURIComponent`'d — listing
ids contain `:`).

## Behavior

- `activeZone`/`sortMode` are plain `useState`; filtering/sorting happen inline on every
  render (5 items, no memoization needed).
- Card action row (2026-09-20, from the designer's PR #32, wired to the backend):
  - **Book a visit**: same `createViewingController` as the detail gate, never live. Mock
    mode renders "Simulated · <slot>" with a tooltip stating no call or booking was made;
    live mode renders "Call requested · awaiting confirmation". Nothing says "booked".
  - **Heart**: per-session bookmark via `PUT /api/saved` (`listing_save` table), optimistic
    with rollback, `aria-pressed`. No ranking effect; cleared by the demo reset.
  - **X**: records a persisted `other` rejection (`POST /api/feedback`), hides the
    card, and the status row offers Undo plus optional "Why?" chips that `PATCH` the reason
    into `too_expensive` / `wrong_area` / `missing_balcony` so the rerank can learn. The
    full reason picker (`RejectionControl`) lives only on the match detail gate.
- No pagination, no websocket/polling — "I'll let you know as soon as a new one comes in"
  is aspirational copy.

## Responsive

- Banner and filter row `flex-wrap`; grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.

## Notes

- Components: `apps/web/components/flow/explore/{ExploreFeed,CandidateCard}.tsx`; data:
  `lib/feed.ts` (`buildFeed`) + `lib/flow/adapters.ts` (`toFlowListing`).
- Photos are real cover URLs from the listing portals, rendered as plain `<img>` (portal
  CDNs aren't in `next/image`'s allow-list); empty `coverUrl` renders a `bg-mist` block.
- Scores and match reasons come from `lib/match.ts`'s `scoreListing` — currently Spanish
  strings inside the English UI (known gap, see `.agents/MEMORY.md`).
- When `buildFeed` had to relax constraints to fill the feed, `feed.note` renders as a
  small amber line under the agent intro.

## User flow checkpoints

```
entry (/explore — from onboarding's "Start searching", or /'s
       "See an example match"; redirected to /onboarding without a profile)
  -> optional: click a neighborhood chip -> feed re-filters in place
  -> optional: change the sort dropdown -> feed re-sorts in place
  -> click any card -> /explore/[id] (match detail)
```
