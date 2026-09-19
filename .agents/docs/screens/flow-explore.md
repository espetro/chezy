# Screen: /flow explore candidates feed (`/flow/explore`)

Client component (`ExploreFeed`) rendering an agent status banner, a zone-filter chip row
+ sort dropdown, and a responsive grid of `CandidateCard`s over 5 fixed mock listings. No
pagination, no live updates — everything is client-side `.filter()`/`.sort()` over a
static array (`apps/web/lib/flow/mock-listings.ts`).

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
top-left. Card is a `<Link>` to `/flow/explore/[id]`.

## Behavior

- `activeZone`/`sortMode` are plain `useState`; filtering/sorting happen inline on every
  render (5 items, no memoization needed).
- No "mark interest" / "discard" action on the feed itself — that's one level in, on the
  match detail's `AgentContactGate`.
- No pagination, no websocket/polling — "I'll let you know as soon as a new one comes in"
  is aspirational copy.

## Responsive

- Banner and filter row `flex-wrap`; grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.

## Notes

- Components: `apps/web/components/flow/explore/{ExploreFeed,CandidateCard}.tsx`; data:
  `apps/web/lib/flow/mock-listings.ts`.
- Photos are remote Unsplash stock images via `next/image`
  (`images.unsplash.com` allow-listed in `apps/web/next.config.ts`) — not real listings.
- Scoring is hand-authored per mock listing, not computed from onboarding answers.

## User flow checkpoints

```
entry (/flow/explore — from onboarding's "Start searching", or /flow's
       "See an example match")
  -> optional: click a neighborhood chip -> feed re-filters in place
  -> optional: change the sort dropdown -> feed re-sorts in place
  -> click any card -> /flow/explore/[id] (match detail)
```
