# Norma compliance pass, 2026-09-19

Branch `chore/norma-compliance-pass` on top of the fork's main (`calohco/chezy2`, a fork of
`espetro/chezy` imported into the Norma portal because `espetro/chezy` could not be rescanned). Scope: chezy authored
code in `apps/web`. Vendor and untouched upstream files are accepted, see the register.

## Scores

| | Production-Ready Score | Open issues |
|---|---|---|
| Before (portal Full Scan of `calohco/chezy2`) | 62/100, Conditional | 366 |
| After (portal rescan) | TBD, needs the rescan after merge | TBD |

Before, per dimension: Performance 77%, Scalability 65%, Manageability 83%, Security 24%
(FAIL), Maintainability 88%, Architecture 100%. The portal also shows 130 AI generated
prompt findings; those are not part of the score.

Per file findings during the fixes came from `live_check`, which works without a linked
repo and reported reduced coverage (1 semgrep rule not evaluable) on every call. The
repo is now linked (id 10146, reference branch main).

## Fixed

| rule | severity | where | how |
|---|---|---|---|
| `js-fetch-no-timeout` | MEDIUM | `lib/ai/models.ts`, `lib/vonage.ts`, `lib/calendar.ts` (2 sites), `lib/slng.ts`, `lib/ai/tools/get-weather.ts` (2 sites), `lib/vision/extract.ts`, `lib/utils.ts` | `FETCH_TIMEOUT_MS` in `lib/constants.ts`; `AbortSignal.timeout` on server calls; client helpers bound time to headers only |
| `rct-unsafe-href-binding` | HIGH (Security) | `components/chat/listing-results.tsx` | scraped `listing.url` went straight into `href`; now gated by `safeHttpUrl` (http/https only), link omitted otherwise |
| `js-mng-loopback-url` | HIGH | `lib/ai/models.ts`, `lib/ai/providers.ts` | config read through `lib/env.ts`; the loopback default now lives once in `lib/constants.ts` |

Norma re-check after the fixes: `providers.ts` and `errors.ts` clean; `models.ts` and
`get-weather.ts` no longer report the timeout finding; `models.ts` no longer reports the
loopback finding.

Also changed, not driven by a Norma finding (Norma reports the old code clean):

- `ChatbotError.toResponse` logs through logtape instead of `console.error`.
- `/api/viewing` and `/api/calendar` log provider failures server side. Before, a failing
  Vonage, SLNG or Google call was returned to the caller and never recorded.
- Timeouts surface as `ChatbotError` `timeout:chat` / `timeout:api` (HTTP 504).

## Accepted register

Every entry names its own reason.

- **`apps/web/vendor/chatbot-template/**` and untouched upstream files.** Verbatim
  `vercel/chatbot` import. Editing it breaks the reference copy invariant gated in
  `apps/web/AGENTS.md`. Re-aligning it is the tracked manual review checklist.
- **`js-mng-loopback-url` on `DEFAULT_PROVIDER_BASE_URL` in `lib/constants.ts`.** Still
  flagged. It is the documented local dev fallback (CLAUDE.md: default gateway is a local
  bifrost), read only by server modules, overridden by `OPENAI_COMPATIBLE_BASE_URL`. The
  rule targets literals shipped to a browser. Removing it means choosing a different
  default gateway, which is a product decision, not a compliance one.
- **`js-mng-loopback-url` in `playwright.config.ts` and `.env.example`.** Test harness
  target and a template file. Correct by design.
- **`js-no-error-handling-async`, callee already total.** `lib/ai/models.ts` (4 sites, all
  awaiting `fetchBifrostModels`/`getActiveModels`, which catch and return `[]`) and
  `lib/ai/tools/get-weather.ts` (`await geocodeCity`, returns `null` on failure).
- **`js-no-error-handling-async`, throws to a caller that handles it.** `lib/calendar.ts`
  (5 sites). `createGoogleEvent` throws by contract and its only caller, the
  `/api/calendar` route, catches, logs and returns a typed 502. `lib/utils.ts`: the
  `return await fetch` sits in a try/finally whose callers catch. `/api/viewing` was
  checked and is clean.
- **`js-no-error-handling-async` and `ts-any-type-usage` on upstream lines.**
  `fetcher`'s `await response.json()` and `weatherData: any` in `get-weather.ts` are
  upstream code. Known gap: `fetcher` throws a `SyntaxError` on a non JSON error body.
- **`js-console-log-only` in CLI scripts** (`scripts/validate.ts`, `apps/web/scripts/*.ts`,
  `lib/db/migrate.ts`). stdout is their output channel; JSON logs would break the
  human readable `validate` output the pre push gate prints.
- **Supabase ruleset.** We do not use Supabase; its remediation targets (Edge Functions,
  `supabase secrets set`) do not exist in this app.
- **Not re-checked individually:** `lib/vonage.ts`, `lib/slng.ts`, `lib/vision/extract.ts`.
  Their change is a one line `signal`; expect the same `js-no-error-handling-async` class
  as `calendar.ts`.

## Security triage (the 10 highs, Security is 24% and the biggest lever)

Only one was chezy authored and real (`listing-results.tsx`, fixed above). The rest:

- `enrich-listings.ts`: a token count flagged as a secret, false positive.
- `app/layout.tsx`: static theme bootstrap script, no user input reaches it.
- diff view and functions `innerHTML`: upstream template code.
- sidebar and multimodal cookies: non sensitive UI preferences, upstream.

## Verification

- After the rebase onto the fork's main: typecheck clean, 103 tests pass in 14 files.
- Baseline before changes: typecheck green, 42 web tests pass (`/tmp/chezy-norma-baseline-real-*.log`).
  The stock `mise run validate` baseline is vacuous on a fresh branch ("no changes vs
  origin/main"), so it was not used as the comparison.
- `next build` compiles. It then fails collecting page data for `/api/viewing` with
  `import.meta.dirname` undefined in `lib/vision/extract.ts`. Same failure on plain
  `origin/main`, so it predates this branch.
- Trap avoided: importing the `@chezy/observability` index from `lib/errors.ts` broke the
  client bundle (`node:console` via the file sink), because `errors.ts` is reachable from
  `lib/utils.ts`. Caught by `next build`, not by tsc or vitest.

## Defence (two minutes)

**Fixed: `js-fetch-no-timeout`.** Not a style nit, a real hang. Every outbound fetch had
no deadline, so a slow gateway froze the model selector and stalled `/api/viewing` and
`/api/calendar` until the platform killed them. One shared helper in `lib/utils.ts` plus
`AbortSignal.timeout` at each server call site closes it across ten call sites, and the
abort now reaches the user as a timeout message. One detail worth saying out loud: the
client timer stops once headers arrive, otherwise it would cut off long chat streams.

**Accepted: `js-no-error-handling-async` on `calendar.ts` and `models.ts`.** The rule is
HIGH severity and we declined it. In `models.ts` the awaited function already catches and
returns a total value; in `calendar.ts` the function throws by contract to the one route
that catches, logs and returns a typed 502. Wrapping each await in a second try/catch
would add noise without changing behaviour. What was really missing was the log line in
the route catch, and we added that.

Honest footnote: the loopback rule still fires on one documented dev default. We reduced
it from two duplicated literals to one and did not pretend it was gone.
