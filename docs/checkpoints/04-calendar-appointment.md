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
- UI: `apps/web/components/chat/viewing-card.tsx` (PR #47). Frozen-surface
  equivalent: the "Visit booked for {slot}" state in
  `components/flow/match/AgentCallGate.tsx`.
- Env: `CALENDAR_MODE`, `GOOGLE_*` service-account vars in `apps/web/lib/env.ts`.

## Mock / real

- `mock` is enough for done and for the recording of the in-app card.
- `google` writes a real event with the service account. For the wow shot, open the
  Google Calendar web UI or phone app on the same slot after the app shows the card;
  record both if you can.

### Google setup (about 5 minutes, all from the CLI)

The app authenticates as a GCP service account and inserts events into whatever
calendar that account has been granted access to. Nothing here is committed: the key
file and the three env values live outside git, per repo policy.

1. Pick a GCP project and enable the Calendar API, then create the service account and
   download its key outside the repo:

   ```bash
   gcloud config set project <project-id>
   gcloud services enable calendar-json.googleapis.com
   gcloud iam service-accounts create chezy-calendar --display-name "Chezy calendar booking"
   mkdir -p ~/.config/chezy
   gcloud iam service-accounts keys create ~/.config/chezy/gcal-sa.json \
     --iam-account chezy-calendar@<project-id>.iam.gserviceaccount.com
   chmod 600 ~/.config/chezy/gcal-sa.json
   ```

   The service account needs no IAM roles in the project; calendar access is granted
   by calendar sharing, not by IAM.

2. Give the service account a calendar to write to. Recommended: a dedicated
   calendar rather than your primary one, so the key can only touch demo events.
   Either create a calendar named "Chezy viewings" in Google Calendar and share it
   with `chezy-calendar@<project-id>.iam.gserviceaccount.com` under "Make changes to
   events", or let the service account create and share one (Calendar API
   `calendars.insert` followed by `acl.insert` with `role: owner` for your Gmail
   address, using the `https://www.googleapis.com/auth/calendar` scope). The
   calendar's ID is under Settings > Integrate calendar (`...@group.calendar.google.com`
   for secondary calendars, your Gmail address for the primary one).

3. Point the app at it in `apps/web/.env.local`:

   ```bash
   CALENDAR_MODE="google"
   GOOGLE_CALENDAR_ID="<calendar-id>"
   GOOGLE_SERVICE_ACCOUNT_JSON_PATH="/Users/<you>/.config/chezy/gcal-sa.json"
   ```

   Restart the dev server; env is parsed once at boot.

4. Smoke test without the UI: from `apps/web`, run a one-off script that calls
   `bookViewing` from `~/lib/calendar` with a slot an hour or two ahead
   (`node --env-file=.env.local --import tsx <script>`). Expect
   `{ status: "booked", channel: "google", eventId }` and the event on the calendar.
   Delete the test event afterwards.

Notes:

- Only the chat `arrangeViewing` tool and the SLNG `book_viewing` webhook create
  events. The `/explore/[id]` call gate does not book anything by design.
- `/api/demo/reset` refuses to run unless both `VIEWING_MODE` and `CALENDAR_MODE` are
  `mock`; switch back to `mock` between rehearsals if you need a reset.
- To hand the integration to a teammate, share the key file and the three env lines
  through a password manager or an encrypted channel, never through chat or git.
  Revoke with `gcloud iam service-accounts keys delete <key-id> --iam-account ...`
  when the demo is over.

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
