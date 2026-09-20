# Checkpoint 3: Book a visit

**Outcome:** on the user's yes, the voice agent phones the property owner or agency in
Spanish, discloses it is an AI, and agrees a viewing slot.

Owner: (fill in)

## Entry state

Checkpoint 2 exit state: a `listingId` the user wants to visit, and a yes.

## Exit state (definition of done)

- One outbound call is dispatched for that listing (`VIEWING_MODE=slng` or `vonage`),
  or a mock dispatch returns a slot (`VIEWING_MODE=mock`).
- The call opens with the AI disclosure (EU AI Act art. 50) and speaks Spanish.
- A slot is agreed and comes back as `slotIso`.
- A `Viewing` row is persisted: `userId`, `listingId`, `channel`, `callId`, `slotIso`,
  `status` (`dispatched` | `mock` | `failed`) (table in PR #47, migration 0006).
- The app shows "calling" then the agreed slot, or the failure detail with a retry.

## Contract with checkpoint 4

Hands over `{ propertyRef: listingId, slotIso }` to the booking step. In `slng` mode
the SLNG agent's `book_viewing` tool POSTs exactly that to `APP_BASE_URL/api/calendar`
(`BookingRequestSchema`, `packages/contract`). In mock mode the app calls
`bookViewing` directly with the mock slot.

## Where the code lives

- Dispatch: `apps/web/lib/viewing.ts` (`dispatchViewing`, PR #47; previously inline in
  `apps/web/app/api/viewing/route.ts`, which is now a thin wrapper).
- SLNG: `apps/web/lib/slng.ts` (`dispatchSlngCall`), agent pin script
  `apps/web/scripts/slng-agent-sync.ts` (`mise run slng:agent:sync`). Call variables
  read aloud: `listingToCallVariables` in `lib/listings.ts`,
  `insightsToCallVariables` in `lib/insights.ts`.
- Vonage: `apps/web/lib/vonage.ts` (`placeVonageCall`, NCCO talk action).
- Tool: `apps/web/lib/ai/tools/arrange-viewing.ts` (PR #47). Frozen-surface
  equivalent: `components/flow/match/AgentCallGate.tsx` (auto-calls at 95, localStorage
  guard so a real phone rings once per listing per browser).
- Env: `VIEWING_MODE`, `DEMO_AGENCY_PHONE`, `SLNG_*`, `VONAGE_*`, `APP_BASE_URL` in
  `apps/web/lib/env.ts` and `.env.example`.

## Mock / real

- `mock` is the default and is enough for done. No callee needed.
- `slng` dials `DEMO_AGENCY_PHONE` for real (the dataset has zero agency phones). Use
  the controlled +34 number only. Never on a loop, never in an e2e test
  (`tests/e2e/flow-happy-path.test.ts` refuses to run under `slng`).
- `APP_BASE_URL` must be reachable from SLNG for the webhook in real mode (tunnel).

## Verification

- `pnpm exec vitest run app/api/viewing/route.test.ts lib/slng.test.ts`.
- Turn 4 of `mise run eval:trace` (PR #47) asserts `arrangeViewing` fires only after
  the user's yes.
- Real mode: one manual call to the controlled number, transcript saved to
  `.agents/notes/` with the date.

## Recording (video id `call`)

- About 25 s. Must show: the user's approval, the dialing state, the AI disclosure
  line, the agreed slot.
- Record the app screen in mock or real mode; the video overlays the Spanish
  transcript with an English translation from copy, no call audio is needed
  (`.agents/plans/2026-09-19-demo-video.md` Q14). If you have a real call, also save
  the transcript text for the copy file.

## Open

- Busy line / no answer fallback is Layer 2; in the demo a failed dispatch shows the
  detail and a retry, nothing more.
