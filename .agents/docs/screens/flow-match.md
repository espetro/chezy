# Screen: match detail + agent call gate (`/explore/[id]`, formerly `/flow/explore/[id]`)

Server page (`apps/web/app/(flow)/explore/[id]/page.tsx`) loading the real listing via
`getListingRowById` (404 via `notFound()` when absent), scoring it with `scoreListing`
against the session's `SearchProfile`, and rendering `MatchDetail`: listing detail, "why
it's a match" reasons, and a neighborhood profile — with one client island,
`AgentCallGate`: the reference implementation of this product's autonomous action,
calling the agency. There is no email/draft step anymore (removed 2026-09-19) — calling
is the only agentic action this surface demonstrates.

## ASCII mockup

State 1 — detail:

```
| <- Back to candidates                                              |
+---------------------------------------------------------------+
| [======================= photo =========================]     |
+---------------------------------------------------------------+
| Bright apartment with balcony                        96% match |
| Gràcia, Barcelona · 62 m² · 2 bd · available Nov 1, 2026        |
| [Exterior-facing][Elevator][Renovated]              €1050/month|
+---------------------------------------------------------------+
| Why it's a match                                                |
|  •  Within budget          €1,050 vs. your €1,100 ceiling       |
|  •  Priority neighborhood   Gràcia is your #1 neighborhood pick |
|  •  18 min to your office   Under your 30 min limit             |
+---------------------------------------------------------------+
| Neighborhood profile                                            |
|   Commute to your office                            18 min      |
|   Shops & leisure   [===============.....]  92/100               |
|   Nightlife         [============.......]    78/100               |
|   Safety             [=============......]    85/100               |
|   Noise              [========...........]    45/100               |
+---------------------------------------------------------------+
```

State 2a: **auto-call** (score ≥95%, e.g. Gràcia at 96%): the gate fires one call on
mount, no click needed. Every request asks for a live call (`live: true`); under
`VIEWING_MODE=mock` the server answers with a simulated slot instead, and only then does
the header show a quiet `Demo` pill (product decision 2026-09-20,
`.agents/plans/2026-09-20-call-flow-motion.md`). With `slng`/`vonage` configured, a real
phone rings, so the auto-call guard (one per listing per browser) matters.

```
+---------------------------------------------------------------+
| (•)  Chezy agent                                     [ Demo ]  |
|      Matched above 95%, so Chezy called the agency on its own. |
|                                                                |
|  +------------------------------------------------------------+|
|  |                    ((( (•) )))                              ||  <- CallProgress: ember rings
|  |                     AI calling                              ||
|  |            Calling aProperties Real Estate                  ||  <- transcript lines slide
|  |               Asking about the listing                      ||     down (motion/react) as
|  |            Proposing Monday 13:00                           ||     the stage advances
|  |               Confirming the visit                          ||
|  +------------------------------------------------------------+|
|                                                                |
|  [ Not for me ]   (disabled while calling)                     |
+---------------------------------------------------------------+
```

Stages: mock calls advance one line every `MOCK_STAGE_MS` (800 ms); live calls advance
the middle lines on `LIVE_STAGE_AT_MS` (0 / 12 s / 35 s) while the gate polls
`GET /api/viewing/status` every `LIVE_POLL_MS` until the voice agent's `book_viewing`
webhook marks the `Viewing` row booked (or `LIVE_CALL_TIMEOUT_MS` passes). Dispatch and
that webhook are the only two real signals today; the middle stages are a timeline until
the provider streams events. A simulated slot is booked by the client via
`POST /api/calendar` ("Booking the visit…"); either path resolves to:

```
+---------------------------------------------------------------+
| (•)  Chezy agent                                     [ Demo ]  |
|      Matched above 95%, so Chezy called the agency on its own. |
|                                                                |
|  +------------------------------------------------------------+|
|  |                        (✓)                                  ||  <- BookedCheck: disc pops,
|  |                    Visit booked                             ||     check draws
|  |            Monday 21 September at 13:00                     ||
|  |     Bright apartment with balcony · Gràcia                  ||
|  |          30 min · added to your calendar                    ||
|  +------------------------------------------------------------+|
|                                                                |
|  [ Not for me ]                                                |
+---------------------------------------------------------------+
```

Live calls need `VIEWING_LIVE_ENABLED=true` and the configured `DEMO_AGENCY_PHONE`
target on the server; there is no client opt-in anymore (removed 2026-09-20). Failures
land on "Couldn't reach the agency" plus the server's detail line and "Try again", which
retries with the same requestId. A failed booking after a simulated call shows the
calendar detail and "Try again" re-posts the same slot.

State 2b: **below threshold** (score <95%, e.g. Eixample at 75%): nothing happens until
the user asks.

```
+---------------------------------------------------------------+
| (•)  Chezy agent                                     [ Demo ]  |
|      75% match. Below Chezy's 95% bar to call alone; you can   |
|      start the call.                                           |
|                                                                |
|  +------------------------------------------------------------+|
|  | Ready to call the agency for you.                           ||
|  +------------------------------------------------------------+|
|                                                                |
|  [ Call the agency ]   [ Not for me ]                          |
+---------------------------------------------------------------+
```

"Call the agency" runs the same calling → booking → booked sequence as State 2a.

State 3: "Not for me" (either path): "Candidate rejected." with "Undo".

## Behavior

- `AgentCallGate` (`apps/web/components/flow/match/AgentCallGate.tsx`) takes only
  `{ listing }` — no `autonomy` prop. **The 95% threshold overrides the autonomy tier
  entirely**: a ≥95% match calls autonomously no matter what the user picked in onboarding
  (`assist`/`cowork`/`autopilot`); this was a deliberate product decision, not an oversight
  — see `.agents/plans/2026-09-19-port-to-main.md`'s later addendum.
- State: `lib/flow/use-viewing-booking.ts` composes two controllers. `lib/viewing.ts`
  owns the call (`idle | dispatching | simulated | dispatched | failed`, `failed` carries
  `retryable` and `live`); `lib/booking.ts` owns the calendar step
  (`idle | booking | booked | failed`). `derivePhase` folds both into
  `idle | calling | booking | booked | awaiting | failed` for rendering.
  `isAutoCall = listing.matchScore >= AUTO_CALL_MATCH_THRESHOLD` (95,
  `lib/flow/constants.ts`). When `isAutoCall`, nothing is restored from storage and
  `localStorage["chezy:autocall:<listingId>"]` is unset, `useMountEffect` sets the key
  and fires `start()` on mount. The guard keeps the auto request to one per listing per
  browser, and it is always `live: false`, so no real phone ever rings from a page load.
- `start()` POSTs `/api/viewing` with `{ propertyRef, live: true, requestId, retry }`. On
  a `mock` result the client walks the stages and POSTs `{ propertyRef, slotIso }` to
  `/api/calendar`; on `dispatched` the server has inserted a `Viewing` row and the client
  polls `GET /api/viewing/status?propertyRef=` until it reads `booked` (set by
  `/api/calendar` when the voice agent books). A `booked` result is persisted to
  `localStorage["chezy:booking:<listingId>"]` and restored on reload, so "Visit booked"
  survives navigation (checkpoint 4). Live receipts persist to
  `localStorage["chezy:viewing:<listingId>"]` (`{ requestId, result?, retry }`) as before,
  and a restored `dispatched` receipt resumes polling.
- The same hook drives `BookVisitAction` in `components/flow/explore/CandidateCard.tsx`:
  "Book a visit" → "AI calling…" (ring pulse) → "Booking…" → pill "Booked · Mon 13:00".
- Live calls require `VIEWING_LIVE_ENABLED=true` and the configured `DEMO_AGENCY_PHONE`
  team target on the server; `VIEWING_MODE=mock` degrades every request to the simulated
  slot. A retryable failure keeps `live` on record, so "Try again" retries with the same
  `requestId` and `retry: true`.
- "Not for me" is available from any non-rejected status; "Undo" restores whatever the
  status box showed before the rejection (it does not replay the request).

## Responsive

- Single column, `max-w-[1000px]` centered; photo `h-80` → `md:h-96`.

## Notes

- Components: `apps/web/components/flow/match/{MatchDetail,NeighborhoodProfile,
  AgentCallGate,CallProgress}.tsx`, `components/flow/ui/BookedCheck.tsx`; the gate calls
  `POST /api/viewing` and `POST /api/calendar` directly. Animations are CSS keyframes in
  `globals.css` (`call-ring`, `check-pop`, `check-draw`), all disabled under
  `prefers-reduced-motion`.
- **Wired to the real call infra (2026-09-19)**: `startCall` POSTs `/api/viewing`
  (`lib/slng.ts`/`lib/vonage.ts`/mock per `VIEWING_MODE` → `ViewingResult`). The old
  simulated `lib/flow/calling.ts` helper is deleted — the session-free rationale went
  away when `/flow` was promoted to the root and put behind `proxy.ts`'s guest auth.
- Previously this screen had an email-draft gate (`AgentContactGate`, removed 2026-09-19)
  with an approve/edit/discard flow and a per-autonomy-tier copy table (`gateCopy`). That
  component and its draft builder (`lib/flow/agent-draft.ts`) are gone; don't recreate them
  — calling is the only agentic action this screen shows now.

## User flow checkpoints

```
/explore/[id] entry -> read match reasons + neighborhood profile
  -> if matchScore >= 95%: gate auto-fires one call per listing per browser
     (localStorage guard) -> "AI calling" transcript -> "Booking the visit…"
     -> "Visit booked" + slot + "added to your calendar"
  -> if matchScore < 95%: gate shows "Ready to call the agency for you." +
     [Call the agency] -> click -> same sequence, on demand
  -> live provider configured: same transcript, stages on the live timeline, gate polls
     /api/viewing/status until the book_viewing webhook marks the row booked
     -> failed / timeout: "Couldn't reach the agency" + detail -> [Try again], same requestId
  -> reload after booked: "Visit booked" restored from the booking receipt
  -> [Not for me] (either path) -> "Candidate rejected." -> [Undo] -> back to the
     prior status box state
```
