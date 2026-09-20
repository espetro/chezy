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

State 2a: **auto-call simulation** (score ≥95%, e.g. Gràcia at 96%): the gate fires one
simulated request on mount, no click needed. Automatic requests always simulate
(`live: false`); they never dial.

```
+---------------------------------------------------------------+
| (•)  [ Auto-call simulation · ≥95% match ]                      |  <- FlowBadge accent
|      This match cleared the 95% confidence bar. Rehearsal      |
|      simulates the call; a live demo call requires your        |
|      explicit approval.                                        |
|                                                                |
|  +------------------------------------------------------------+|
|  | (•) Requesting call…                                        ||  <- pulsing ember dot
|  +------------------------------------------------------------+|
|                                                                |
|  [ Discard candidate ]   (disabled while requesting)           |
+---------------------------------------------------------------+
```

...resolves on its own to the simulated outcome:

```
+---------------------------------------------------------------+
| (•)  [ Auto-call simulation · ≥95% match ]                      |
|      This match cleared the 95% confidence bar. Rehearsal      |
|      simulates the call; a live demo call requires your        |
|      explicit approval.                                        |
|                                                                |
|  +------------------------------------------------------------+|
|  | [ Simulated ]                                               ||
|  | Example viewing: Monday, 7:00 PM                            ||
|  | No phone call or calendar booking was made.                 ||
|  +------------------------------------------------------------+|
|                                                                |
|  [ ] I authorize a real call to the configured team test       |
|      number.                                                   |
|  [ Request live demo call ]   [ Discard candidate ]            |
+---------------------------------------------------------------+
```

A live demo call (opt-in checked + `VIEWING_LIVE_ENABLED=true` + configured team target)
lands on the dispatched state instead:

```
|  +------------------------------------------------------------+|
|  | Call requested                                              ||
|  | Awaiting agency confirmation. No appointment is booked.    ||
|  | SLNG · redacted:0123456789ab                               ||
|  | Request-to-dispatch: 180 ms (server receipt to provider    ||
|  | acknowledgement, including lookup). This is not            ||
|  | conversational latency.                                    ||
|  +------------------------------------------------------------+|
|                                                                |
|  [ Discard candidate ]                                         |
```

Failures land on "Call request could not be confirmed" plus the server's detail line.
A retryable live failure (provider rejection, network error) adds "Try again", which
retries live with the same requestId. A pre-dispatch rejection (live disabled, bad target,
auth) instead restores "Simulate viewing call" and the opt-in controls, since no live
attempt is on record.

State 2b: **below threshold** (score <95%, e.g. Eixample at 75%): nothing happens until
the user asks.

```
+---------------------------------------------------------------+
| (•)  75% match                                                  |
|      This is below my 95% bar for calling on my own. I'll keep |
|      watching it, or you can simulate the call.                |
|                                                                |
|  +------------------------------------------------------------+|
|  | No call requested.                                          ||
|  +------------------------------------------------------------+|
|                                                                |
|  [ Simulate viewing call ]                                     |
|  [ ] I authorize a real call to the configured team test       |
|      number.                                                   |
|  [ Request live demo call ]   [ Discard candidate ]            |
+---------------------------------------------------------------+
```

"Request live demo call" is disabled until the checkbox is checked, and the checkbox
clears again after each attempt. "Simulate viewing call" runs the same
"Requesting call…" → "Simulated" sequence as State 2a.

State 3: "Discard candidate" (either path): "Candidate discarded." with "Undo".

## Behavior

- `AgentCallGate` (`apps/web/components/flow/match/AgentCallGate.tsx`) takes only
  `{ listing }` — no `autonomy` prop. **The 95% threshold overrides the autonomy tier
  entirely**: a ≥95% match calls autonomously no matter what the user picked in onboarding
  (`assist`/`cowork`/`autopilot`); this was a deliberate product decision, not an oversight
  — see `.agents/plans/2026-09-19-port-to-main.md`'s later addendum.
- State: `status: "idle" | "dispatching" | "simulated" | "dispatched" | "failed"`, plus a
  separate `discarded` flag; `failed` also carries `retryable` and `live` (whether a live
  attempt is on record). `isAutoCall = listing.matchScore >= AUTO_CALL_MATCH_THRESHOLD`
  (95, `lib/flow/constants.ts`). When `isAutoCall` and
  `localStorage["chezy:autocall:<listingId>"]` is unset, `useMountEffect` (from
  `@chezy/ui/hooks/useMountEffect`) sets the key and fires a simulated `startCall` on
  mount. The guard keeps the auto request to one per listing per browser, and it is
  always `live: false`, so no real phone ever rings from a page load.
- `startCall(live)` POSTs `/api/viewing` with `{ propertyRef, live, requestId?, retry }`
  via `lib/viewing.ts`'s controller. `mock` renders the "Simulated" badge with
  "Example viewing: {slot}" (slot formatted `Europe/Madrid`) and "No phone call or
  calendar booking was made."; `dispatched` renders "Call requested", "Awaiting agency
  confirmation. No appointment is booked.", "<CHANNEL> · redacted:<id>" and a
  "Request-to-dispatch: N ms" timing line; `failed` renders "Call request could not be
  confirmed" plus the server's `detail`. Live results persist to
  `localStorage["chezy:viewing:<listingId>"]` (`{ requestId, result?, retry }`) and are
  restored on reload; simulated results are not persisted.
- Live calls require the explicit opt-in checkbox on the client plus
  `VIEWING_LIVE_ENABLED=true` and the configured `DEMO_AGENCY_PHONE` team target on the
  server. A pre-dispatch rejection (400/401/403/503) clears the live flag: the failed
  state offers "Simulate viewing call" and the opt-in block again, with no "Try again".
  A retryable provider rejection (502) or a network error keeps `live` on record, so
  "Try again" retries live with the same `requestId` and `retry: true`.
- "Discard" is available from any non-discarded status; "Undo" restores whatever the
  status box showed before the discard (it does not replay the request).

## Responsive

- Single column, `max-w-[1000px]` centered; photo `h-80` → `md:h-96`.

## Notes

- Components: `apps/web/components/flow/match/{MatchDetail,NeighborhoodProfile,
  AgentCallGate}.tsx`; the gate calls `POST /api/viewing` directly.
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
  -> if matchScore >= 95%: gate auto-fires one simulated request per listing per
     browser (localStorage guard) -> "Requesting call…" -> "Simulated" +
     "No phone call or calendar booking was made."
  -> if matchScore < 95%: gate shows "No call requested." + [Simulate viewing call]
     -> click -> same simulated sequence, on demand
  -> live path (both): check "I authorize a real call…" -> [Request live demo call]
     -> dispatched: "Call requested" + "Awaiting agency confirmation…" +
     "SLNG · redacted:<id>" + "Request-to-dispatch: N ms"
     -> failed: "Call request could not be confirmed" + detail
        -> retryable live failure: [Try again] retries live, same requestId
        -> config rejection: simulate + opt-in controls return, no live lock-in
  -> [Discard candidate] (either path) -> "Candidate discarded." -> [Undo] -> back to
     the prior status box state
```
