# Screen: /flow match detail + agent call gate (`/flow/explore/[id]`)

Server component (`MatchDetail`, statically generated per listing via
`generateStaticParams`) rendering listing detail, "why it's a match" reasons, and a
neighborhood profile — with one client island, `AgentCallGate`: the reference
implementation of this product's autonomous action, calling the agency. There is no
email/draft step anymore (removed 2026-09-19) — calling is the only agentic action `/flow`
demonstrates.

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
|      This match cleared chezMoi's 95% confidence bar, so the   |
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
|      This match cleared chezMoi's 95% confidence bar, so the   |
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
- State: `status: "idle" | "calling" | "booked" | "discarded"`. `isAutoCall =
  listing.matchScore >= AUTO_CALL_MATCH_THRESHOLD` (95, `lib/flow/constants.ts`). When
  `isAutoCall`, `status` initializes to `"calling"` directly (not `"idle"`) and
  `useMountEffect` (from `@chezy/ui/hooks/useMountEffect`) starts the resolution timer on
  mount — the same "one sanctioned effect" pattern already used by `OnboardingFlow`'s
  thinking simulation.
- The "calling" → "booked" transition is a `setTimeout` in
  `CALL_DIALING_DELAY_MS` (1.2–2.2s, mirrors `AGENT_THINKING_DELAY_MS`'s shape) that calls
  `nextVisitSlot()` (`apps/web/lib/flow/calling.ts` — pure, next business day, rounded to
  the half hour, 10:00–19:00, 30-minute visit).
- "Discard" is available from any non-discarded status; "Undo" returns to `"idle"` for
  below-threshold listings or `"booked"` for auto-call listings (i.e. undo doesn't replay
  the call — it restores whatever the terminal non-discarded state was expected to be).
- `generateStaticParams` prebuilds all 5 mock listing pages at build time; an unknown `id`
  calls `notFound()`.

## Responsive

- Single column, `max-w-[1000px]` centered; photo `h-80` → `md:h-96`.

## Notes

- Components: `apps/web/components/flow/match/{MatchDetail,NeighborhoodProfile,
  AgentCallGate}.tsx`; call/booking helpers: `apps/web/lib/flow/calling.ts`.
- **Not wired to the real call infra**: this repo already has a working
  `POST /api/viewing` (`lib/slng.ts`/`lib/vonage.ts` → `ViewingResult`) →
  `POST /api/calendar` (`lib/calendar.ts` → `BookingResult`) flow from the dropped
  "radar" demo (see `.agents/docs/screens/radar.md`, types in
  `packages/contract/src/index.ts`). `/flow` doesn't call either route: `apps/web/proxy.ts`
  gates `"/api/:path*"` behind a session, and `/flow` is deliberately session-free (it's
  excluded from that same proxy by pathname, not by exempting the API routes). Calling the
  real routes from an unauthenticated `/flow` page would bounce through
  `/api/auth/guest` and reintroduce the auth dependency `/flow` exists to avoid.
  `lib/flow/calling.ts` mirrors the `ViewingResult`/`BookingResult` vocabulary (a booked
  slot, a duration) without importing `@chezy/contract`, so the simulation stays
  dependency-free. If `/flow`'s call feature ever graduates into the real product surface,
  swap `calling.ts`'s local timer for the real two-POST sequence at that point.
- Previously this screen had an email-draft gate (`AgentContactGate`, removed 2026-09-19)
  with an approve/edit/discard flow and a per-autonomy-tier copy table (`gateCopy`). That
  component and its draft builder (`lib/flow/agent-draft.ts`) are gone; don't recreate them
  — calling is the only agentic action this screen shows now.
- No mock listing scored ≥95% before this change (max was Gràcia at 94%); it was bumped to
  96% specifically so the auto-call path is reachable in the demo — see
  `lib/flow/mock-listings.ts` and the corresponding `matching.test.ts` assertion.

## User flow checkpoints

```
/flow/explore/[id] entry -> read match reasons + neighborhood profile
  -> if matchScore >= 95%: gate auto-starts "Calling {agency}…" -> "Called · booked {slot}"
     (no click required)
  -> if matchScore < 95%: gate shows "Not called yet." + [Call the agency now]
     -> click -> "Calling {agency}…" -> "Called · booked {slot}" (same sequence, on demand)
  -> [Discard candidate] (either path) -> "Candidate discarded." -> [Undo] -> back to
     idle (below threshold) or booked (auto-call)
```
