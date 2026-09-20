# Persistent preference feedback (JES-8)

## Consumer contract for JES-12 / JES-13

`@chezy/contract` exports `FEEDBACK_REASONS`, `FeedbackReasonSchema`,
`FeedbackInputSchema`, `FeedbackUndoInputSchema`, `FeedbackEventSchema`,
`FeedbackOutputSchema`, `FeedbackListOutputSchema`, `ProfileVersionSchema` and
the corresponding inferred types (`FeedbackReason`, `FeedbackInput`,
`FeedbackUndoInput`, `FeedbackEvent`, `FeedbackOutput`, `FeedbackListOutput`,
`ProfileVersion`).

`apps/web/lib/profile-version.ts` exports **the single version source**
`getProfileVersion(profile: SearchProfile): ProfileVersion`. It is a string:
`sha256:` followed by 64 lowercase hex characters. SHA-256 covers the JSON of
the entire persisted SearchProfile with alphabetically sorted top-level keys.
Dates serialize as ISO strings. This includes the profile ID, ownership, stored
preferences and timestamps, detects changes even in the same millisecond and
changes after reset/recreation. It is an equality token, not a sortable counter.
Consumers must call this export on a fresh server-loaded profile; do not make
another timestamp/version implementation. The detail explanation cache uses it.

`apps/web/lib/feedback.ts` exports:

- `recordFeedback(userId, input): Promise<FeedbackEvent>`
- `undoFeedback(userId, eventId): Promise<FeedbackEvent>`
- `listActiveFeedback(userId): Promise<FeedbackEvent[]>` (oldest first)
- `getFeedbackEvent(userId, eventId): Promise<FeedbackEvent | undefined>`
- `toFeedbackEvent(row)` and `FeedbackError(message, status)`
- `clearUserFeedback(transaction, userId)`, registered in `demoUserCleanups`

User IDs passed to these server functions must come from `auth()`. The store
authors `userId`, `profileVersion`, `createdAt` and a listing-facts snapshot.
The profile token describes the database snapshot read when the rejection is
recorded. Changes to chat-only `User.profile` do not change SearchProfile.

`GET /api/feedback` returns `{events}` for the current authenticated guest/user.
`POST /api/feedback` accepts exactly `{eventId, listingId, reason}`.
`DELETE /api/feedback` accepts exactly `{eventId}`. Both return `{event}`.
Mutations require JSON and reject cross-origin browser requests.
Request-supplied ownership, profile versions and facts are rejected.

The committed database row and mutation response are the durable publication
seam; no message broker or provider call is implied. JES-12 can consume the
response or re-read `getFeedbackEvent(authenticatedUserId, eventId)`, validate
`FeedbackEventSchema`, compare `getProfileVersion(currentProfile)`, and reject
undone/stale work. Use `(userId, eventId)` for idempotency. Client integrations
can use `useListingFeedback(onSaved)`; `onSaved(event)` receives the validated
response after persistence. Re-check server ownership before external actions.

Example event captured by the real local database check (synthetic test listing,
subsequently deleted):

```json
{
  "schemaVersion": 1,
  "type": "listing.rejected",
  "eventId": "6b0b1026-5a4f-4f71-aefd-dac6c27bc97c",
  "userId": "64099be6-eb30-4bf1-9a0e-51d0e3a8718b",
  "listingId": "feedback-check:a8b0b690-0bcf-41cf-ba5a-debfba1dc204",
  "reason": "missing_balcony",
  "profileVersion": "sha256:982f4b0b72ecbd4ed6afab9921aea9d3d2b7feeaa406eb85d066547221dd62a8",
  "createdAt": "2026-09-20T00:19:29.231Z",
  "undoneAt": null,
  "facts": {
    "priceEur": 1700,
    "neighbourhood": "Poblenou",
    "amenities": ["exterior"]
  }
}
```

## Dedupe, Undo and reset

Record, Undo and demo reset serialize on the authenticated User row. The unique
index is `(user_id, event_id)`. Same event/payload retries return the original
event; conflicting payload reuse returns 409. A second event ID for an already
rejected listing returns the active canonical event without amplifying learning.
The caller must use that returned event ID for Undo.

Undo sets `undoneAt` once, retains the original event/version, and removes both
the hidden listing and its ranking effect. A delayed retry of that original ID
returns the tombstone, never reactivates it. A deliberate rejection after Undo
uses a new event ID. Other active rejections remain. Active rejections survive
profile edits; only Undo or reset removes them.

`clearUserFeedback` uses the reset transaction and a user filter to delete active
and undone rows. A downstream cleanup failure rolls the entire reset back.
Guest sessions use the same database isolation as registered users. No feedback
is stored in shared browser storage.

## Ordering and UI

`rankListings(profile, rows, feedback?)` removes active rejections and applies the
existing `no_interior` rule before scoring. `buildFeed(profile, run?, minItems?,
feedback?)` preserves the existing candidate query and relaxation ladder; feedback
does **not** trigger extra budget relaxation. The existing ladder may broaden
budget when inventory is sparse and still reports that in its note.

Soft ordering only: +25 for listed balcony/terrace when requested; up to +25 for
known rent below the lowest rejected known rent; -25 for a rejected known
neighborhood. Repeated reasons do not accumulate an unbounded bonus. The displayed
match score and budget are unchanged. Ties use price then listing ID.
Unsupported deposit/suspicious-ad red lines remain stored-only as before.
No model or vision inference is introduced. Cards explicitly label outdoor-space
evidence as listing-reported amenities.

On the explore feed, the card's X (`Discard this candidate`) records a
`other` rejection: the listing is hidden with Undo, the rerank is
unchanged, and optional "Why?" chips let the user refine the event into one of the
three specific reasons through `PATCH /api/feedback` `{eventId, reason}` (the
listing facts are reason-independent, so only the reason changes). On the match
detail the full picker offers the three reasons plus "Other", Cancel and
Escape, all without gestures. Successful writes
refresh server results; failures show an alert and allow an idempotent retry.
Keyboard focus goes to the next ranked card (or the empty result) after exit.
Undo focuses the feed region. Detail rejection offers in-place Undo and a link
to the updated feed, preserving its mounted viewing controller and call display.
Rejected detail URLs redirect on reload before mounting auto-call.
The viewing controller and call authorization logic are unchanged.

## Verification

```sh
mise run demo:setup
mise exec -- pnpm --filter @chezy/web test:unit
mise exec -- pnpm --filter @chezy/contract test
# From apps/web:
mise exec -- node --env-file-if-exists=.env.local --import=tsx scripts/check-feedback.ts
# From the repository root:
mise run validate
mise exec -- node --env-file=apps/web/.env.local --run build
```

Migration `0006_equal_stellaris.sql` was generated with Drizzle from the active
app schema and applied to pg0; no schema-push shortcut. The runtime and migration
config currently use `apps/web/lib/db/schema.ts`, despite the broader package
schema convention.

Unit checks cover the real HTTP handlers, strict contract, supported ranking,
unchanged budget/red lines and version stability. The database script uses
isolated disposable users/listing to check concurrent dedupe, reload, ownership,
Undo, delayed retry, profile edits, transactional rollback and reset isolation.
Browser keyboard/layout acceptance and live providers require separate proof.
This feature itself makes no provider requests.
