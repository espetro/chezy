# Evidence: QualityClouds / Norma challenge

Challenge (from [`docs/hackbarna.md`](../hackbarna.md)): run Norma — the deterministic
code-quality checker — against the project. Requirement: **one scan, at least one fix,
and one rescan.** Judged on final Production-Ready Score, issues found and fixed during
the event (audit-trail delta), and a two-minute "defend your code" explanation.

Scanned repository: `calohco/chezy2` (Norma portal repository id **10146**, reference
branch `main`). This is the fork imported into the Norma portal because
`espetro/chezy` could not be rescanned.

## Scan → fix → rescan

| | Production-Ready Score | Issues |
|---|---|---|
| Before (portal Full Scan, 2026-09-19) | 62/100, Conditional | 366 open |
| After (portal rescan, 2026-09-20 09:55 UTC) | **67/100, Conditional** | 627 shown |

Per-dimension deltas (before → after):

| Functional area | Before | After |
|---|---|---|
| Architecture | 100% | 100% (0 issues) |
| Maintainability | 88% | 92% (41 issues) |
| Performance | 77% | 90% (55 issues) |
| Manageability | 83% | 86% (59 issues) |
| Scalability | 65% | 66% (463 issues, 442 HIGH) |
| Security | 24% FAIL | 30% FAIL (9 issues, 9 HIGH) |

Issue-count displays differ between views (366 "open" vs 627 shown) because portal
counting changed between scans; the score and per-dimension percentages are the
comparable numbers.

Screenshot of the rescan result: [`norma-rescan-2026-09-20.png`](norma-rescan-2026-09-20.png)
(captured locally at
`/Users/josocjoq/Documents/recordings/Screenshot 2026-09-20 at 11.58.02.png`).

## What was fixed

| Rule | Severity | Where | How |
|---|---|---|---|
| `js-fetch-no-timeout` | MEDIUM | `lib/ai/models.ts`, `lib/vonage.ts`, `lib/calendar.ts` (2), `lib/slng.ts`, `lib/ai/tools/get-weather.ts` (2), `lib/vision/extract.ts`, `lib/utils.ts` | Shared `FETCH_TIMEOUT_MS` in `lib/constants.ts`; `AbortSignal.timeout` on server calls; timeouts surface as typed `ChatbotError` (HTTP 504) |
| `rct-unsafe-href-binding` | HIGH (Security) | `components/chat/listing-results.tsx` | Scraped `listing.url` now gated by `safeHttpUrl` (http/https only) |
| `js-mng-loopback-url` | HIGH | `lib/ai/models.ts`, `lib/ai/providers.ts` | Config via `lib/env.ts`; single documented dev default in `lib/constants.ts` |

In-flight findings were verified with the Norma MCP `live_check` per file and recorded
through `register_applied_actions` (append-only audit trail). Fix commits: PR #29
(`chore/norma-compliance-pass`) plus `fix/norma-rescan-followup`; both are contained in
the scanned `calohco/chezy2` `main`.

## Defence (two minutes)

**Fixed — `js-fetch-no-timeout`.** Not a style nit, a real hang. Every outbound fetch had
no deadline, so a slow gateway froze the model selector and stalled `/api/viewing` and
`/api/calendar` until the platform killed them. One shared helper plus
`AbortSignal.timeout` at each server call site closes it across ten call sites, and the
abort now reaches the user as a timeout message. The client timer stops once headers
arrive so it does not cut off long chat streams.

**Consciously accepted — the remaining HIGH findings are upstream template code.** The 9
security HIGHs (`dangerouslySetInnerHTML`, `innerHTML` assignments, `document.cookie`
writes, a static theme bootstrap) and the bulk of the 442 scalability HIGHs
(`js-no-error-handling-async` on upstream awaits) live in the verbatim `vercel/chatbot`
import under `apps/web`. Editing it breaks the reference-copy invariant gated in
`apps/web/AGENTS.md`; re-aligning it is a tracked manual-review item, not a compliance
fix. The one real chezy-authored security finding (`listing-results.tsx`) was fixed.

Full decision log, accepted-findings register, and verification details:
[`.agents/notes/2026-09-19-norma-compliance.md`](../../.agents/notes/2026-09-19-norma-compliance.md).
