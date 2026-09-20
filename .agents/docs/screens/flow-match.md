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
mount, no click needed. Automatic requests always simulate (`live: false`); they never
dial. Disclosure is one quiet `Demo` pill in the header (product decision 2026-09-20,
`.agents/plans/2026-09-20-call-flow-motion.md`); no other simulation copy remains.

```
+---------------------------------------------------------------+
| (•)  Chezy agent                                     [ Demo ]  |
|      Matched above 95%, so Chezy called the agency on its own. |
|                                                                |
|  +------------------------------------------------------------+|
|  |                    ((( (•) )))                              ||  <- CallProgress: ember rings
|  |                 Calling the agency                          ||
|  |                 Dialing the agency                          ||  <- steps fade up at
|  |        Introducing itself as Chezy's AI assistant           ||     0 / 900 / 1800 ms
|  |               Asking for a viewing slot                     ||
|  +------------------------------------------------------------+|
|                                                                |
|  [ Not for me ]   (disabled while calling)                     |
+---------------------------------------------------------------+
```

The calling state holds for at least `CALL_SEQUENCE_MS` (2600 ms) even though the mock
provider answers in under 100 ms. A simulated slot is then handed to `POST /api/calendar`
("Booking the visit…"), which resolves to:

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
|  › Place a real call                                           |  <- collapsed <details>
+---------------------------------------------------------------+
```

A live demo call (opt-in checked under "Place a real call" + `VIEWING_LIVE_ENABLED=true`
+ configured team target) lands on the awaiting state instead; the client never books a
live call (the SLNG `book_viewing` webhook does):

```
|  +------------------------------------------------------------+|
|  | (phone) Call in progress                                    ||
|  |         The agency is being asked for a slot.               ||
|  +------------------------------------------------------------+|
```

Failures land on "Couldn't reach the agency" plus the server's detail line. A
retryable live failure (provider rejection, network error) adds "Try again", which
retries live with the same requestId. A pre-dispatch rejection (live disabled, bad target,
auth) instead restores "Call the agency" and the opt-in controls, since no live attempt
is on record. A failed booking after a simulated call shows the calendar detail and "Try
again" re-posts the same slot.

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
|  › Place a real call                                           |
+---------------------------------------------------------------+
```

"Request live demo call" is disabled until the checkbox is checked, and the checkbox
clears again after each attempt. "Call the agency" runs the same calling → booking →
booked sequence as State 2a.

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
- `start(live)` POSTs `/api/viewing` with `{ propertyRef, live, requestId?, retry }`,
  awaits at least `CALL_SEQUENCE_MS`, and on a `mock` result POSTs
  `{ propertyRef, slotIso }` to `/api/calendar`. A `booked` result is persisted to
  `localStorage["chezy:booking:<listingId>"]` and restored on reload, so "Visit booked"
  survives navigation (checkpoint 4). Live results persist to
  `localStorage["chezy:viewing:<listingId>"]` (`{ requestId, result?, retry }`) as before.
- The same hook drives `BookVisitAction` in `components/flow/explore/CandidateCard.tsx`:
  "Book a visit" → "Calling…" (ring pulse) → "Booking…" → pill "Booked · Mon 13:00".
- Live calls require the explicit opt-in checkbox on the client plus
  `VIEWING_LIVE_ENABLED=true` and the configured `DEMO_AGENCY_PHONE` team target on the
  server. A pre-dispatch rejection (400/401/403/503) clears the live flag: the failed
  state offers "Call the agency" and the opt-in block again, with no "Try again".
  A retryable provider rejection (502) or a network error keeps `live` on record, so
  "Try again" retries live with the same `requestId` and `retry: true`.
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
     (localStorage guard) -> "Calling the agency" (≥2.6 s) -> "Booking the visit…"
     -> "Visit booked" + slot + "added to your calendar"
  -> if matchScore < 95%: gate shows "Ready to call the agency for you." +
     [Call the agency] -> click -> same sequence, on demand
  -> live path (both): open "Place a real call" -> check "I authorize a real call…"
     -> [Request live demo call]
     -> dispatched: "Call in progress" + "The agency is being asked for a slot."
     -> failed: "Couldn't reach the agency" + detail
        -> retryable live failure: [Try again] retries live, same requestId
        -> config rejection: [Call the agency] + opt-in controls return, no live lock-in
  -> reload after booked: "Visit booked" restored from the booking receipt
  -> [Not for me] (either path) -> "Candidate rejected." -> [Undo] -> back to the
     prior status box state
```
