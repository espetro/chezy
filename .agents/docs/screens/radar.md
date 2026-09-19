# Screen: Concierge / Radar (dual-view demo)

Captured from the day-0 demo (`app/page.tsx` on `feat/viewing` PRs, later
`/radar`, since dropped — this file is the contract for rebuilding it).
One page, two views behind a segmented toggle: **Concierge** is a scripted
chat transcript that frames the forensic finding in narrative form;
**Radar** is a swipe-deck property card with the same finding rendered as
structured data. The card's "Like" action fires the voice-agent call flow
and opens a live-call modal.

Everything is one client component with inline styles (no Tailwind yet),
a 760px centered column, dark monochrome palette (`#0a0a0a` canvas,
`#111113` cards, `#27272a` hairlines, `#a1a1aa` muted text) with a single
blue accent (`#2563eb`), amber for forensic warnings, green for pass/booked.

## ASCII mockup

Header (shared by both views): wordmark left, segmented toggle right.

```
+------------------------------------------------------------------+
| chezy                    [ Concierge | Radar ]                    |
+------------------------------------------------------------------+
^ toggle: pill track (#17171a, radius 10), active segment is a raised
  light pill (#fafafa bg, #0a0a0a text), inactive is muted (#a1a1aa).
```

State 1: Concierge view — scripted transcript, left/right bubbles.

```
|                                          Find me a bright 2 bed  |  <- user, blue #2563eb
|                                          near Arc de Triomf,     |
|                                          under 380k.             |
|                                                                  |
|  Three candidates. Card 1 has a problem: 0% direct sunlight,     |  <- assistant, #1c1c1e
|  windows onto a 1.5 m lightwell, and it is 13% over the          |
|  El Raval average.                                               |
|                                                                  |
|  Card 2 in Eixample is south facing and 17% under the            |
|  neighborhood average. Want me to line that one up?              |
|                                                                  |
|  [ -> View on Radar ]                                            |  <- ghost CTA, blue border/text
+------------------------------------------------------------------+
^ bubbles max-width 85%, radius 14, user right-aligned blue,
  assistant left-aligned dark. The CTA switches to Radar — it is the
  narrative bridge: chat names the insight, radar shows the card.
```

State 2: Radar view — forensic property card + action row.

```
| +----------------------------------------------------------------+ |
| | Atico centrico luminoso                              El Raval  | |
| | EUR 349,000                                          (28px)    | |
| | 68 m2 · 5,132 EUR/m2 (barrio 4,548)                  (muted)   | |
| | +------------------------------------------------------------+ | |
| | | Forensic warning: 0% direct sunlight, windows onto an      | | |  <- amber: bg #3a2a08,
| | | inner patio.                                               | | |     border #b45309, text #fbbf24
| | +------------------------------------------------------------+ | |
| |  * Ventanas a patio interior de 1.5 m                          | |
| |  * 0% luz solar directa                                        | |
| |  * 13% sobre media del barrio                                  | |
| +----------------------------------------------------------------+ |
| [        Pass        ] [   Like, call the agency   ]               |
+------------------------------------------------------------------+
^ card: radius 18, border #27272a, bg #111113, padding 20.
  pass state (sunlight === "direct") renders a plain green line
  (#4ade80): "Forensic check passed: direct sunlight confirmed."
  buttons: Pass = ghost (border #3f3f46), Like = solid blue, both
  flex 1, radius 12, padding 14 vertical.
```

State 3: Like pressed — live-call modal (fixed overlay, `role="dialog"`).

```
+==================================================================+
|                  (dimmed backdrop rgba(0,0,0,0.72))               |
|    +------------------------------------------------------+      |
|    | Live call                                            |      |
|    | Dialing +34 612 34 56 78...                          |      |
|    | Agent: Hola, soy el asistente autonomo de Jessie.    |      |  <- monospace 13px,
|    |        Llamo por el piso.                            |      |     #d4d4d8, gap 6
|    | Agency: Si, sigue disponible. Cuando quieres...      |      |
|    | ...                                                  |      |
|    | [                    Close                     ]     |      |
|    +------------------------------------------------------+      |
+==================================================================+
^ modal card: min(520px, 100%), bg #111113, border #27272a, radius 16.
  Title is phase-driven: "Live call" (calling) / "Viewing confirmed"
  (booked) / "Call failed" (error). On booked, a green line under the
  transcript: "Booked <slot toLocaleString('es-ES')> (<detail>)".
```

## Behavior

- View toggle is pure client state (`useState<View>`), default
  `concierge`. No routing per view — the toggle is the whole nav.
- Concierge is fully scripted: a fixed `MESSAGES` array renders the
  user request plus two assistant replies that already contain the
  forensic conclusion. It exists to teach the mental model (assistant
  reasons about sunlight and price-vs-barrio) before the user sees the
  card. The "-> View on Radar" CTA is the only interaction.
- Radar renders a deck from `MOCK_PROPERTIES` (deterministic fixtures,
  no network — each card carries pre-extracted `truthTags`). `Pass`
  advances `index` and resets the call state; `propertyAt` wraps the
  deck cyclically.
- `Like` kicks off the two-call orchestration, chained client-side:
  1. `POST /api/viewing` `{propertyRef, agencyPhone}` → `ViewingResult`
     (mock by default; `VIEWING_MODE=slng|vonage` switches to a real
     voice-agent dispatch).
  2. `POST /api/calendar` `{propertyRef, slotIso, durationMinutes: 30}`
     → `BookingResult` (`CALENDAR_MODE=mock|google`).
  `slotIso` falls back to `now + 24h` when the viewing response omits it.
- The transcript is canned, not live: `like()` seeds four lines at
  dispatch and appends the confirmation pair on success. The modal's
  value is phase + the booked slot, not real streaming (that needs a
  voice-agent webhook back-channel — open item).
- Error path: any fetch throw or `booking.status !== "booked"` lands in
  `phase: "error"`, transcript collapses to "Call failed.", and
  `detail` carries the message into the modal.
- Property data shape (`MockProperty`): `id`, `title`, `neighborhood`,
  `priceEur`, `cadastralSqm`, `pricePerSqm`, `neighborhoodAvgPerSqm`,
  `sunlight: "direct" | "lightwell"`, `truthTags: readonly string[]`,
  `agentLine`. The forensic binary is `sunlight`; everything else is
  display + the two API payloads.

## Responsive

- Single centered column `max-width 760px`, `padding 20px 16px 64px`.
- Modal is `min(520px, 100%)` with 20px viewport padding — already
  mobile-safe. No other breakpoints in the demo; bubbles cap at 85%.

## Notes

- Demo-scoped styling: everything is inline `style={{...}}` — deliberate
  for a throwaway demo, not a pattern to propagate. A rebuild should map
  the palette onto Tailwind/shadcn tokens (the accent is the only brand
  decision worth keeping: `#2563eb` for primary actions and user bubbles).
- The concierge transcript and call transcript are Spanish-flavored on
  purpose (agent persona "asistente autonomo de Jessie", es-ES date
  locale). Keep the locale when rebuilding — it sells the use case.
- The demo predates the verbatim `vercel/chatbot` import. If concierge
  is rebuilt inside the chatbot, the scripted transcript becomes a real
  conversation and "View on Radar" becomes a tool-invocation card — the
  chatbot's message surface is the natural host.
- Deleted implementation: `app/radar/page.tsx` + `lib/fixtures/mock-
  properties.ts` (recover from git history; the API routes it called —
  `app/api/viewing`, `app/api/calendar`, `lib/slng.ts`, `lib/vonage.ts`,
  `lib/calendar.ts` — remain live).

## User flow checkpoints

```
entry -> concierge view (scripted transcript) -> "View on Radar" CTA
   -> radar card (forensic warning/pass + truth tags)
   -> Pass: next card, call state reset
   -> Like: live-call modal opens (phase=calling, transcript seeds)
      -> POST /api/viewing -> POST /api/calendar
      -> phase=booked: green "Booked <slot>" line -> Close -> back on card
      -> phase=error: "Call failed" + detail -> Close -> back on card
```
