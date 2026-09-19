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
