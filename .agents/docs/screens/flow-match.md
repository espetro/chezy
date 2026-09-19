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

State 2a — **auto-call** (score ≥95%, e.g. Gràcia at 96%): the gate starts calling on its
own, no click needed.

```
+---------------------------------------------------------------+
| (•)  [ Auto-call · ≥95% match ]                                 |  <- FlowBadge accent
|      This match cleared Chezy's 95% confidence bar, so the   |
|      agent called Tecnocasa Gràcia automatically — no approval |
|      needed.                                                    |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | • Calling Tecnocasa Gràcia…                                 | |  <- pulsing ember dot,
|  +------------------------------------------------------------+ |     ~1.2–2.2s
|                                                                  |
|  [ Discard candidate ]                                          |
+---------------------------------------------------------------+
```

...resolves on its own to:

```
+---------------------------------------------------------------+
| (•)  [ Auto-call · ≥95% match ]                                 |
|      This match cleared Chezy's 95% confidence bar, so the   |
|      agent called Tecnocasa Gràcia automatically — no approval |
|      needed.                                                    |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | Called Tecnocasa Gràcia                                      | |
|  | Visit booked for Monday, 7:00 PM (30 min).                   | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  [ Discard candidate ]                                          |
+---------------------------------------------------------------+
```

State 2b — **below threshold** (score <95%, e.g. Eixample at 88%): nothing happens until
the user asks.

```
+---------------------------------------------------------------+
| (•)  88% match                                                  |
|      This is below my 95% bar for calling on my own. I'll keep |
|      watching it, or you can ask me to call now.                |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | Not called yet.                                              | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  [ Call the agency now ]  [ Discard candidate ]                 |
+---------------------------------------------------------------+
```

Clicking "Call the agency now" runs the identical Calling…→Called sequence as State 2a.

State 3 — "Discard candidate" (either path): "Candidate discarded." with "Undo".

## Behavior

- `AgentCallGate` (`apps/web/components/flow/match/AgentCallGate.tsx`) takes only
  `{ listing }` — no `autonomy` prop. **The 95% threshold overrides the autonomy tier
  entirely**: a ≥95% match calls autonomously no matter what the user picked in onboarding
  (`assist`/`cowork`/`autopilot`); this was a deliberate product decision, not an oversight
  — see `.agents/plans/2026-09-19-port-to-main.md`'s later addendum.
- State: `status: "idle" | "calling" | "booked" | "failed" | "discarded"`. `isAutoCall =
  listing.matchScore >= AUTO_CALL_MATCH_THRESHOLD` (95, `lib/flow/constants.ts`). When
  `isAutoCall` and `localStorage["chezy:autocall:<listingId>"]` is unset,
  `useMountEffect` (from `@chezy/ui/hooks/useMountEffect`) sets the key and fires
  `startCall` on mount — the guard keeps a real phone from ringing on every page load.
- `startCall` POSTs `/api/viewing` with `{ propertyRef: listing.id }`. On a non-failed
  response it renders "Visit booked for {slot}" (slot formatted `Europe/Madrid`,
  30 min); a `dispatched` status additionally shows "Live call in progress". A failed
  response (or non-2xx) shows the server's `detail` and a "Try again" button that retries
  `startCall`.
- "Discard" is available from any non-discarded status; "Undo" returns to `"booked"` if a
  visit was booked, else `"idle"` (i.e. undo doesn't replay the call — it restores
  whatever the terminal non-discarded state was expected to be).

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
  -> if matchScore >= 95%: gate auto-calls once per listing per browser
     (localStorage guard) -> "Called · booked {slot}" (+ "Live call in progress" when
     dispatched); failure -> detail + [Try again]
  -> if matchScore < 95%: gate shows "Not called yet." + [Call the agency now]
     -> click -> same sequence, on demand
  -> [Discard candidate] (either path) -> "Candidate discarded." -> [Undo] -> back to
     idle or booked
```
