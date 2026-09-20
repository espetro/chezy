# Checkpoint 4: Calendar appointment

**Outcome:** the agreed slot becomes a calendar event and shows up in the app as a
confirmed viewing. This is the success point of the demo; make it land.

Owner: (fill in)

## Entry state

Checkpoint 3 exit state: `{ propertyRef, slotIso }` from the call, a `Viewing` row in
`dispatched` or `mock` status.

## Exit state (definition of done)

- `POST /api/calendar` (or `bookViewing` directly) returns `status: "booked"` with the
  `slotIso` and, in `google` mode, an `eventId`.
- The `Viewing` row is updated to `status: "booked"` (PR #47; the calendar route marks
  the newest non-booked row for that `propertyRef`).
- The app shows the appointment: listing title, agency, channel, date and time in
  `Europe/Madrid`, 30 minutes. It survives a reload (read from the `Viewing` table, not
  from component state).
- The agent confirms the time in one sentence. Nothing else happens after this.

## Contract

Input is `BookingRequestSchema` (`packages/contract`): `propertyRef`, `slotIso`,
optional `durationMinutes`, `summary`, `description`. Output is `BookingResult`:
`status`, `channel`, `slotIso`, optional `eventId`, `detail`.

## Where the code lives

- Booking: `apps/web/lib/calendar.ts` (`bookViewing` PR #47, `mockBooking`,
  `createGoogleEvent`, `nextSlotIso`). Route `apps/web/app/api/calendar/route.ts`.
- Persistence: `Viewing` table in `apps/web/lib/db/schema.ts`, queries
  `insertViewing`, `markViewingBooked` in `apps/web/lib/db/queries.ts` (PR #47).
- UI: `apps/web/components/chat/viewing-card.tsx` (PR #47). Flow surface: the
  "Visit booked" phase in `components/flow/match/AgentCallGate.tsx` and the
  "Booked · {slot}" pill in `components/flow/explore/CandidateCard.tsx`, both driven by
  `lib/flow/use-viewing-booking.ts`, which POSTs a mock slot to `/api/calendar` itself
  or, after a live dispatch, polls `GET /api/viewing/status` until the SLNG
  `book_viewing` webhook has marked the `Viewing` row booked. The receipt is kept in
  `localStorage["chezy:booking:<listingId>"]` so it survives a reload. Mock
  `/api/viewing` inserts no `Viewing` row, so `markLatestViewingBooked` is a no-op in
  mock mode; the client receipt is the persistence there.
- Env: `CALENDAR_MODE`, `GOOGLE_*` service-account vars in `apps/web/lib/env.ts`.

## Mock / real

- `mock` is enough for done and for the recording of the in-app card.
- `google` writes a real event with the service account. For the wow shot, open the
  Google Calendar web UI or phone app on the same slot after the app shows the card;
  record both if you can.

## Verification

- `pnpm exec vitest run` on the calendar route test once one exists (none on main
  today; add `app/api/calendar/route.test.ts` covering mock booked, google failure
  502, and the `Viewing` status update).
- Trace eval turn 4 (PR #47) checks the `arrangeViewing` output contains a booking.
- Manual: reload the page; the appointment is still there.

## Recording (video id `booked`)

- About 15 s plus the closing tagline. Must show: the booked message with the slot,
  the calendar card, and (if using the video's sidebar) all checkpoints checked.
- Optional second angle: the real Google Calendar event on a phone. Same 393:852
  aspect if possible.

## Open

- Time zone: `nextSlotIso` computes the next business slot; confirm it lands within
  agency hours and not on the demo day itself when recording.
- Cancel / reschedule are out of scope.
