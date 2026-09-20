# Evidence: Vonage

Challenge (from [`docs/hackbarna.md`](../hackbarna.md)): the Vonage prize is for the
**Video API**. Our implementation uses the **Voice API** for the agency call — real,
working code, but it does not compete for the prize track.

## What exists

[`apps/web/lib/vonage.ts`](../../apps/web/lib/vonage.ts):

- `signVonageJwt()` — hand-rolled RS256 JWT via `node:crypto` with `application_id`,
  `iat`, `jti`, `exp` claims (no `@vonage/*` dependency; raw fetch + crypto).
- `placeVonageCall()` — `POST https://api.nexmo.com/v1/calls` with an inline NCCO
  (`talk` action, `es-ES` voice) so the callee hears the disclosure and pitch.
- Wired as `VIEWING_MODE=vonage` in [`lib/viewing-call.ts`](../../apps/web/lib/viewing-call.ts)
  and gated behind `VIEWING_LIVE_ENABLED` in `app/api/viewing/route.ts`.

Env: `VONAGE_APPLICATION_ID`, `VONAGE_FROM_NUMBER`, `VONAGE_PRIVATE_KEY` /
`VONAGE_PRIVATE_KEY_PATH` (see [`.env.example`](../../apps/web/.env.example)).

## Live call receipt

From `.agents/notes/2026-09-19-voice-telephony.md` — a real PSTN call placed during the
event:

- `+12012556040` (Vonage LVN) → controlled `+34` number, **answered**, 9 s, €0.0145
  (~€0.097/min), call UUID `fcdf9aa7-94cb-4c39-ac66-bd8abe671660`.

## Gap

No Video API surface exists (that would be a session/token endpoint + an embedded
publisher in the viewing card). If attempted, JWT signing and app credentials from this
file are reused directly.
