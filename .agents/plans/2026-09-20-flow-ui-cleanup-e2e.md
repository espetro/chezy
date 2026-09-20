# Flow UI cleanup + e2e coverage of merged JES features

## Part A: UI fixes (root causes pre-verified)

- A1: `globals.css` — remove `overflow-x: hidden` from the `body` rule (keep
  `html { overflow-x: hidden }`) so `position: sticky` bars engage again.
  Probe-verify: body overflowY `visible`, `.sticky.bottom-0` bottom == innerHeight,
  `.sticky.top-0` stays at 0 after scroll, no horizontal scrollbar.
- A2: `globals.css` — drop Geist-specific `font-feature-settings: "ss01", "ss02",
  "cv01"` (DM Sans ships ss01..ss08 and they swap glyphs).
- A3: `app/layout.tsx` — brand root metadata (`title.default/template`,
  description, `metadataBase` from `env.APP_BASE_URL`); check rendered `<title>`
  on `/` and `/chat`.
- A4: `DemoResetControl.tsx` — collapsed "Demo tools" disclosure row (FlaskConical
  + Show/Hide), expanded shows the two existing actions. Behaviour and button
  labels unchanged.

Files off-limits (designer's PR #32): `(flow)/page.tsx`, `CandidateCard.tsx`,
`MatchDetail.tsx`, `Pill.tsx`.

## Part B: Playwright e2e

- B1: repair `flow-happy-path.test.ts` — current onboarding step order
  (welcome → budget → moveIn → mustHaves → routine → dealBreakers → autonomy →
  summary), "Why this home", JES-11 call-gate strings, sticky assertions.
- B2: new `flow-features.test.ts` — demo tools (JES-5, with a "Reset and load
  demo" beforeEach helper for a deterministic profile), grounded explanation
  (JES-7), rejection persist/rerank (JES-8), carousel + filters + reduced motion
  (JES-10), truthful call states incl. API receipt (JES-11).
- Run on `PORT=3200` worktree server only; serial mode where tests mutate shared
  guest state; screenshots to `/tmp/flow-ui/`.
