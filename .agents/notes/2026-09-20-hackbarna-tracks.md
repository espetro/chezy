# 2026-09-20: HackBarna challenge evidence assessment

Source: `docs/hackbarna.md` (event brief, copied verbatim). Assessed 10:59 CEST Sunday;
submission due ~13:00-14:00, Mastra bot-handle deadline 12:00 (already unrecoverable
unless a bot ships in the hour), async judging 14:00-16:00, top-10 demos 16:00.

## Evidence in hand

| Challenge | Evidence | Gap |
| --- | --- | --- |
| SLNG | `apps/web/lib/slng.ts` full Voice Agents client (pin region/orchestrator,
declared-variable filtering, dispatch), `scripts/slng-agent-sync.ts` +
`mise run slng:agent:sync`, unmute-authored agent pinned `eu-central`/`livekit`
with SIP trunk attached. Dispatch path exercised via `lib/viewing-call.ts` and
`lib/slng.test.ts`. unmute counts as bonus. | Prize wants a recorded/live voice
agent walkthrough + real numbers (latency, cost, audio). No committed recording
yet. One call to the controlled +34 number closes it (~1h). |
| Nebius | Default provider for chat, title, vision (`Kimi-K3`), embeddings via
`api.studio.nebius.com`. | Challenge wants Token Factory use + measurable
improvement. Harness exists (`eval:trace` golden set, tool-trace eval,
`scripts/galtea/run.ts`). A 2-3 model comparison run produces the table
(~1-2h). |
| QualityClouds / Norma | `2026-09-19-norma-compliance.md`: portal Full Scan
62/100 Conditional, 366 issues; 3 rule classes fixed (fetch timeouts, unsafe
href, loopback literals); accepted register; 2-min "defend your code" script
already drafted. Repo linked (id 10146). | Requirement is scan -> fix -> rescan.
After-score TBD; rescan is mechanical (<1h). |

## Partial / needs work

- **Vonage**: `lib/vonage.ts` (JWT-signed NCCO Voice API) + live test call
  (~EUR 0.015). Prize is "Best use of the **Video** API" — voice gets a t-shirt
  only. To compete: a Video API surface (~2-3h; JWT signing already exists,
  embed `@vonage/client`, e.g. video tour with live captions on the viewing
  card).
- **Galtea**: harness complete (`scripts/galtea/`, frozen 10-case suite
  SHA-pinned, SDK upload ready for `galtea==5.2.0`) but "live evidence:
  unexecuted" — credential-blocked (`GALTEA_API_KEY` + product ID), survey not
  done. If creds arrive: before-run -> find failure -> prompt fix -> after-run
  -> survey ≈ 2-2.5h. Without creds, dead.
- **Cognition/Devin**: nothing but a VO credit line. Needs API-driven sessions +
  non-human verifier + shown retry loop. Feasible <3h if the $200/Max redemption
  is done: e.g. Devin writes a new listing-source adapter gated by
  `uv run pytest`, re-dispatched on failure.
- **Mastra**: plan only (`2026-09-20-telegram-bot-adapter.md`), no `apps/bot`.
  Tier 0 alone ~3h and the 12:00 deadline passed the point of no return. Drop.

## Not yet considered, ranked by fit

- **fal.ai (H3 Max Director, $1,000 credits)**: only unconsidered challenge that
  is self-contained and <3h. Plausible chezy fit: a `/tour` route running an
  infinite generated "Barcelona apartment viewing" livestream steered by the
  active shortlist. Risky (real-time video gen under load) but standalone.
  Credit code `hackbarna2026`.
- **Preply (AI for learning)**: weak-to-medium. The forensic debunk is genuinely
  educational; a "learn mode" with progress tracked on the profile is ~2-3h but
  reads as a bolt-on; judges penalize chat wrappers.
- **Titan OS / Norrsken wildfire / Make**: no fit or no defined challenge. Skip.

## Bottom line

3-challenge minimum already met on evidence: SLNG + Nebius + QualityClouds.
Remaining-hours priority: (1) Norma rescan + score delta, (2) recorded SLNG call
+ latency/cost numbers, (3) Nebius model-comparison eval, (4) Galtea or Devin if
credentials land, (5) stretch: Vonage Video surface OR fal.ai livestream — one,
not both.
