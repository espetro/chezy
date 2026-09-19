# Screen specs (chezy)

ASCII mockups and behavior contracts for screens, captured before (or while)
the implementation exists. Each file follows the same format: intro,
`## ASCII mockup`, `## Behavior`, `## Responsive`, `## Notes`,
`## User flow checkpoints`.

- [radar.md](radar.md) — Screen: Concierge / Radar dual-view demo
  (previously `app/page.tsx`, then `/radar`; component dropped, spec kept).
  Scripted concierge transcript framing the forensic finding, swipe-deck
  property card with price-vs-barrio anchoring and sunlight forensics,
  Pass / "Like, call the agency" action row that triggers the voice-agent
  call flow (`/api/viewing` → `/api/calendar`), live-call transcript modal.

- [flow-landing.md](flow-landing.md), [flow-onboarding.md](flow-onboarding.md),
  [flow-explore.md](flow-explore.md), [flow-match.md](flow-match.md) — the
  `/flow/*` UX exploration (2026-09-19): a chat-style onboarding, an explore
  feed, and a match-detail screen with `AgentContactGate` (the reference
  approve/edit/discard agentic gate implementation), ported from a standalone
  prototype and deliberately namespaced under `/flow` — isolated route group,
  isolated design tokens (`apps/web/app/globals.css`), excluded from the auth
  proxy — so it doesn't collide with other in-flight work on `main`'s real
  routes. See `.agents/plans/2026-09-19-port-to-main.md` for the full
  portability rationale and what's still a known gap (onboarding answers
  don't feed the feed's scoring; no real `sendEmail` call).
