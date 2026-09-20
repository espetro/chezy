# Call flow: motion, product copy, calendar wiring

Branch `feat/chezy-0/call-flow-motion` off `main` at `963b00e` (includes PR #32 card
actions, PR #47 chat canonical flow, PR #55 designer card actions, PR #60).

## Why

The viewing call is the product's autonomous action and the demo's success point
(checkpoints 3 and 4), but the surface reads like a compliance form: "Auto-call
simulation", "Rehearsal simulates the call", "No phone call or calendar booking was
made", a request-to-dispatch latency line in ms. The mock `/api/viewing` resolves in
under 100 ms so the "calling" state never registers, and nothing on the flow surface
ever reaches `/api/calendar`, so checkpoint 4 ("the app shows the appointment, it
survives a reload") has no UI on `/explore/[id]`.

Product decisions taken with the owner (2026-09-20):

1. Disclosure collapses to one quiet `Demo` pill in the gate header. Every sentence
   about simulation, rehearsal, latency and "nothing was booked" goes. The pill is the
   answer if a judge asks; it is the only marker.
2. The booking step is real plumbing: after the call resolves with a slot the client
   POSTs `{ propertyRef, slotIso }` to `/api/calendar`. Mock mode returns `booked`; the
   check animation plays on the response, and the result persists so a reload still
   shows the appointment.
3. The calling animation ships in two sizes on one state machine: the detail gate and
   the `CandidateCard` "Book a visit" button.

## State

`ViewingState` in `lib/viewing.ts` stays untouched (its controller and tests own the
live-call safety rules). Booking is a second layer:

```ts
// lib/booking.ts
export type BookingState =
  | { status: "idle" | "booking" }
  | { status: "booked"; result: BookingResult }
  | { status: "failed"; detail: string };

export function createBookingController(
  propertyRef: string,
  storage: { getItem(key: string): string | undefined; setItem(key: string, value: string): void },
  fetcher: typeof fetch = fetch,
): { restore(): BookingState; book(slotIso: string): Promise<BookingState> };
```

- Storage key `chezy:booking:<propertyRef>`, value is the parsed `BookingResult`
  (`BookingResultSchema` from `@chezy/contract`). Only `booked` results are persisted.
- `book()` dedupes in-flight calls and returns the stored result if already booked.
- Non-2xx or unparseable body → `failed` with the server `detail` or a fixed message.

`lib/flow/use-viewing-booking.ts` composes both controllers for the two UIs:

```ts
export function useViewingBooking(listingId: string): {
  call: ViewingState;
  booking: BookingState;
  start(live?: boolean): Promise<void>;   // call, then book on a simulated slot
  restore(): void;                          // both controllers, called from useMountEffect
};
```

- `start()` awaits `Promise.all([controller.start(live), wait(CALL_SEQUENCE_MS)])` so
  the calling animation always plays its full sequence, then books when the call came
  back `simulated`. A `dispatched` (live) call does not book from the client; the SLNG
  webhook does.
- `restore()` order: booking first. A persisted `booked` implies the call happened, so
  `call` is derived as `{ status: "simulated", result: { slotIso } }` shape for
  rendering purposes only (the gate reads `booking.status === "booked"` first).

Constants (`lib/flow/constants.ts`): `CALL_SEQUENCE_MS = 2600` (three scripted steps at
0 / 900 / 1800 ms plus settle; the mock provider answers faster than a phone rings).

## UI

### `components/flow/match/CallProgress.tsx`

Agent mark centred, two ember rings expanding behind it (`--animate-call-ring`, 1.8 s,
staggered 0.9 s), and three steps below that fade up with inline `animationDelay`
0 / 900 / 1800 ms via the existing `animate-fade-up` keyframe:

1. Dialing the agency
2. Introducing itself as Chezy's AI assistant
3. Asking for a viewing slot

Reduced motion: rings `animation-name: none`, steps visible at once. No JS timers; the
step reveal is CSS, the minimum hold lives in `start()`.

### `components/flow/ui/BookedCheck.tsx`

SVG: ember disc scales in (`--animate-check-pop`, 320 ms, overshoot), then the check
path draws via `stroke-dashoffset` (`--animate-check-draw`, 360 ms, 200 ms delay).
Sizes `sm` (20 px, card pill) and `lg` (56 px, gate). Reduced motion: static final
frame.

### `AgentCallGate` (rewrite of the render, same props and safety rules)

Header row: `FlowAgentMark` + "Chezy agent" + one line of context + `FlowPill` "Demo".

- ≥95: "Matched above 95%, so Chezy called the agency on its own."
- <95: "{score}% match. Below Chezy's 95% bar to call alone; you can start the call."

Body (`FlowStateTransition` keyed on a derived `phase`):

| phase | content |
| --- | --- |
| `idle` | "Ready to call the agency for you." + primary "Call the agency" |
| `calling` | `CallProgress` |
| `booking` | small ember dot pulse + "Booking the visit…" |
| `booked` | `BookedCheck lg` + "Visit booked" + slot (`Europe/Madrid`, "Monday 22 September · 10:00") + listing title, neighborhood + "30 min · added to your calendar" |
| `awaiting` (live dispatched) | `PhoneOutgoing` + "Call in progress" + "The agency is being asked for a slot." |
| `failed` | "Couldn't reach the agency" + `detail` + "Try again" when retryable |

Below the body: the live-call opt-in (checkbox + "Request live demo call") moves into a
collapsed `<details>` titled "Place a real call" so the safety control survives without
dominating the card. `RejectionControl` stays where it is. Fixed `min-h-[42rem]` goes;
use `min-h-[22rem]` so the state transition does not jump.

Removed copy: "Auto-call simulation · ≥95% match", "Rehearsal simulates the call…",
"Simulated" badge, "Example viewing:", "No phone call or calendar booking was made.",
the latency line, the `channel · callId` line.

### `CandidateCard` → `BookVisitAction`

Uses `useViewingBooking`. Button label by phase: "Book a visit" → "Calling agency…"
(with a 16 px ring pulse in place of the icon) → "Booking…" → pill `BookedCheck sm` +
"Visit booked · Mon 10:00". Live dispatched: pill "Call in progress". Failed:
"Couldn't reach · try again". `title` attributes drop the simulation sentence.

## Server

None. `/api/calendar` already exists and marks the newest non-booked `Viewing` row.
Mock `/api/viewing` does not insert a `Viewing` row, so `markLatestViewingBooked` is a
no-op in mock mode today (documented, not fixed here; the client-side receipt provides
the reload persistence checkpoint 4 asks for).

## Tests

- `lib/booking.test.ts` (vitest): booked persists and restores; failure body → failed
  with detail; 502 with a `failed` body → failed; in-flight dedupe; restore with corrupt
  storage → idle.
- `tests/e2e/flow-happy-path.test.ts` step 12: expect "Visit booked" and the `Demo`
  pill; the old "Simulated" / "No phone call…" assertions go. Reload the detail page
  and expect "Visit booked" still visible.
- `tests/e2e/explore-card-actions.test.ts` "Book a visit" case: expect the pill text
  `/^Visit booked · /` and no simulation title.
- `.agents/docs/screens/flow-match.md` states section and `docs/checkpoints/04` UI
  pointer updated in the same PR (checkpoint rule in `apps/web/AGENTS.md`).

## Verification

`mise run validate:quick`, `pnpm exec vitest run lib/booking.test.ts lib/viewing.test.ts`,
the two e2e files serially, screenshots at 375 px of `calling`, `booked`, and
`prefers-reduced-motion` variants, zero console errors, no horizontal overflow.

## Addendum (same day): live by default

Owner decision after the first review on the phone build: the call is no longer a
simulation with an opt-in. Every request is `live: true`; `VIEWING_MODE=mock` degrades
it server-side to the simulated slot (dev and e2e keep working, the `Demo` pill appears
only on that path). The checkbox, "Request live demo call" and the `awaiting` phase are
gone. `POST /api/viewing` inserts the `Viewing` row on dispatch and
`GET /api/viewing/status` exposes it; the gate polls it and advances a predefined
transcript (calling, asking about the listing, proposing a date and time, confirming the
visit) on the `LIVE_STAGE_AT_MS` timeline until the booking webhook lands. Provider
event streaming can later drive `stage` directly; the UI contract is the stage index.
