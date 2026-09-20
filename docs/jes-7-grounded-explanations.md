# JES-7: grounded explanation contract

## JES-10 integration

`apps/web/components/flow/match/MatchExplanation.tsx` exports a standalone client
component. Mount it in the match detail presentation; JES-7 does not edit shared
flow roots. It uses SWR and has no effect hook or browser provider credentials.

```tsx
import { MatchExplanation } from "~/components/flow/match/MatchExplanation";

<MatchExplanation
  listing={listingRow}
  matchScore={existingMatchResult.score}
  preferences={searchProfile}
  profileKey={`${searchProfile.userId}:${searchProfile.updatedAt.toISOString()}`}
/>
```

- `listing`: `ExplanationSource` requires `id`, `priceEur`, `pricePeriod`, `rooms`,
  `builtM2`, `amenities`; a full `Listing` row also fits. Pass trusted server data.
- `matchScore`: the existing deterministic `scoreListing` result, unchanged.
  The component calls this “Match score”, never model confidence.
- `preferences?`: `{ maxPriceEur, minRooms, minM2 }` for immediate fallback facts.
- `profileKey`: include user identity and profile revision to isolate SWR results.
  Changing listing ID or profile key loads a fresh explanation.
- Do not duplicate the existing score label beside the panel if that presentation
  already has one. The component is intentionally unmounted until JES-10 wiring.

The client immediately shows source-rendered deterministic reasons while waiting.
HTTP/network errors preserve those reasons. A successful response is marked
“AI explanation” only if validated model selection contributed to the claims.
Fewer than two supported positives is stated explicitly, never padded with fiction.

## Service and endpoint

Server-only `explainMatch(listingId: string, profile?: SearchProfile)` in
`apps/web/lib/ai/explain.ts` returns `GroundedExplanation | undefined`.
`undefined` means the listing does not exist. It reads `ListingInsight` directly;
it never starts extraction or imports the vision extraction runtime.

`POST /api/explain` accepts **only** `{ "listingId": "known-id" }`. It requires
NextAuth, loads the authenticated user's profile, validates the response, and sets
`Cache-Control: private, no-store`. Errors: 400 invalid body, 401 unauthenticated,
404 unknown listing, 503 source-data/service failure. Provider failures return
200 with a labeled deterministic fallback.

`GroundedExplanationSchema` and all public types live in the client-safe
`apps/web/lib/ai/explanation-contract.ts`:

```ts
{
  listingId: string;
  status: "live" | "fallback";
  reason?: "pending" | "request_failed" | "not_configured" |
    "insufficient_facts" | "provider_failed" | "invalid_evidence";
  positives: ExplanationClaim[]; // exactly 2 for live, 0–2 for fallback
  tradeoff: ExplanationClaim;    // tradeoff or explicit unknown
  meta?: {
    provider: "nebius" | "openai-compatible";
    endpointHost: string;        // hostname only, no key/path/query
    requestedModel: string;
    model?: string;             // SDK response modelId
    latencyMs?: number;         // measured provider attempt, including failure
    inputTokens?: number;       // only if SDK returned usage
    outputTokens?: number;
  };
}
```

Claims carry `{ listingId, key, text, kind, source }`. The model can select only
keys, never displayed text or values. Selections must use two distinct positive
facts and one different tradeoff/unknown, all belonging to the requested listing.
Runtime-validated keys are price, rooms, area, five known amenities, stored photo
condition and light. Pets, agency availability, financing and guaranteed sunlight
are not selectable. Missing photo fields stay unknown; enum fallbacks in the
extraction schema are not applied here. Photo claims are explicitly estimates.
No listing descriptions, image summaries or free text reach the selection prompt.

## Provider proof and measurement

Uses the existing `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY`,
`CHEZY_MODEL_ID` and provider factory. HTTPS hosts `api.studio.nebius.com` and
`api.tokenfactory.nebius.com` identify Nebius. Other endpoints are labeled
`openai-compatible`; local Bifrost is never labeled Nebius. Missing/placeholder
keys and test providers return fallback without reporting fabricated usage.
One request, zero retries, 12-second provider timeout, 256 output-token limit.
Audit action `explain.request.complete` records hostname/model/status/measured
latency/returned usage only. No secret, prompt, or unvalidated output is logged.

Official endpoint reference: https://docs.tokenfactory.nebius.com/quickstart

Run from `apps/web` using mise:

```sh
mise exec -- pnpm exec vitest run lib/ai/explanation-contract.test.ts lib/ai/explain.test.ts app/api/explain/route.test.ts
mise exec -- pnpm exec tsx scripts/evaluate-explanations.ts
```

The evaluation uses five pinned synthetic listing rows in
`lib/ai/explanation-fixtures.json`, including absent price/rooms and budget/size
trade-offs. It measures deterministic in-process latency only, and counts
supported factual claims separately from explicit unknowns. Coverage checks source
references, not independent verification of listing truth. It is a demo measurement,
not a statistical benchmark, and never calls a provider. Provider tests use mocks.

Live sponsor proof remains blocked until the parent supplies configured Nebius
access. Then issue a bounded real request for a seeded listing via the authenticated
endpoint and retain its redacted metadata and visible panel evidence. No real Nebius
latency or token measurement is claimed here. An isolated browser harness verified
pending, authenticated fallback and real HTTP 404 states. Integrated browser
verification awaits JES-10 mounting. Keep JES-7 In Progress until proof is complete.
