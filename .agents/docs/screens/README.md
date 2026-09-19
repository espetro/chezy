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
  product surface at `/`, `/onboarding`, `/explore`, `/explore/[id]` (the
  `/flow/*` prototype promoted to the root 2026-09-19): a chat-style
  onboarding that persists `SearchProfile`, an explore feed ranked by
  `scoreListing`, and a match-detail screen with `AgentCallGate` calling the
  real `/api/viewing`. Own design tokens in `apps/web/app/globals.css`;
  session-gated by `proxy.ts` like the rest of the app. See
  `.agents/plans/2026-09-19-port-to-main.md` for the port rationale.
