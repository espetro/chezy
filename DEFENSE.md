# DEFENSE: how we defend this code

HackBarna, QualityClouds/Norma challenge. This file is our two-minute "defend your
code" answer: what was scanned, what the scan/fix/rescan trail shows, one finding we
fixed, and one finding we consciously accepted.

## What was scanned

Norma, the deterministic code-quality checker, ran a Full Scan against this codebase:
the `main` branch of `calohco/chezy2`, the fork of `espetro/chezy` imported into the
Norma portal (repository id 10146) because `espetro/chezy` itself could not be
rescanned. That scanned `main` contains every fix commit described below.

Chezy is a chat-centric AI web app built during the event: a Next.js 16 + React 19 app
in `apps/web` (diverged from a `vercel/chatbot` import), a Python scraping CLI in
`apps/scraper`, and shared packages under `packages/*`.

## Scan, fix, rescan

| | Production-Ready Score | Issues |
|---|---|---|
| Baseline Full Scan, 2026-09-19 | 62/100, Conditional | 366 open |
| Rescan after fixes, 2026-09-20 | **67/100, Conditional** | 627 shown |

| Dimension | Before | After |
|---|---|---|
| Architecture | 100% | 100% (0 issues) |
| Maintainability | 88% | 92% |
| Performance | 77% | 90% |
| Manageability | 83% | 86% |
| Scalability | 65% | 66% |
| Security | 24% FAIL | 30% FAIL |

Portal issue counters changed between scans (366 "open" vs 627 shown); the score and
the per-dimension percentages are the comparable numbers.

Full evidence file: [docs/evidence/norma-qualityclouds.md](docs/evidence/norma-qualityclouds.md)
Rescan screenshot: [docs/evidence/norma-rescan-2026-09-20.png](docs/evidence/norma-rescan-2026-09-20.png)

## One finding we fixed: `js-fetch-no-timeout`

Not a style nit, a real hang. Every outbound `fetch` in the app had no deadline, so a
slow LLM gateway froze the model selector and stalled `/api/viewing` and
`/api/calendar` until the platform killed them. We added one shared `FETCH_TIMEOUT_MS`
constant plus `AbortSignal.timeout` at each of the ten server call sites, and the abort
now reaches the user as a typed timeout error (HTTP 504) instead of a silent stall. One
detail worth saying out loud: the client-side timer stops once response headers arrive,
so it does not cut off long chat streams.

Same pass also fixed `rct-unsafe-href-binding` (a scraped listing URL flowed straight
into `href`; it is now gated by a http/https-only check) and `js-mng-loopback-url`
(duplicated loopback literals collapsed into one documented dev default read through
env config), and added server-side error logging on the provider routes, which was
returning provider failures to the caller without ever recording them.

## One finding we consciously accepted: the upstream template findings

The remaining HIGH findings live in the verbatim `vercel/chatbot` import under
`apps/web`: `dangerouslySetInnerHTML`/`innerHTML` in the diff-view and functions
components, `document.cookie` writes for UI preferences, and a static inline theme
bootstrap script. We accept these deliberately. The directory is a reference copy gated
by an explicit invariant in `apps/web/AGENTS.md`; hand-editing it would diverge from
upstream without changing real-world risk (the cookies hold non-sensitive preferences,
the theme script takes no user input). Re-aligning the template is a tracked
manual-review item, and the residual risk is written down in our accepted-findings
register rather than silently ignored. The one security finding that was both real and
chezy-authored, the unsafe listing URL above, is the one we fixed.

Same reasoning, stated briefly: the Scalability dimension is a volume outlier (463
issues, mostly `js-no-error-handling-async` firing on upstream template awaits). That
is accepted scope, not unexamined debt; the register names each accepted class and its
reason.

## What the score means

67/100 Conditional, up from 62, with the delta coming from real fixes, not scope
games. Architecture is clean at 100%. Every remaining finding is either fixed in the
audit trail or named, reasoned, and registered as accepted. We would rather show a 67
we can defend line by line than a higher number we cannot.
