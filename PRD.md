# chezy PRD

**Finding a flat, made easy.**

Hackathon: September 2026. Demo: Sunday 2026-09-20, 11:00 CEST.
v2: the problem section cites Barcelona market stats (sources linked inline).

## TL;DR

Chezy is a chat-first AI rental concierge for Barcelona. You describe the flat you want;
it searches real listings, forensically checks each one (sunlight, price vs the barrio
average), and when you like one it calls the agency in Spanish and books the viewing onto
your calendar.

## Problem

Two facts about renting in Barcelona compound each other:

1. **Listings lie.** "Luminoso" can mean windows onto a 1.5 m interior lightwell. Photos
   hide the floor, asking prices drift above the barrio average, and the listing is
   written for the agency, not the renter. In Q1 2026, asking rents advertised on
   idealista averaged ~€20/m² in Barcelona while registered rental contracts averaged
   €16.89/m²
   ([INCASÒL data via Spanish Property Insight, Aug 2026](https://www.spanishpropertyinsight.com/2026/08/19/barcelona-rent-controls-rents-rise-while-rental-opportunities-remain-scarce/)).
   The advertised number is not the number people pay.
2. **Speed decides.** Desirable flats are gone in days, sometimes hours: 36% of homes
   rented through idealista in Barcelona in Q2 2026 spent less than 24 hours on the
   market, versus 17% nationally and 9% in Madrid
   ([idealista/data, Aug 2026](https://www.idealista.com/news/inmobiliario/vivienda/2026/08/13/909818-el-17-de-los-alquileres-de-viviendas-en-el-segundo-trimestre-se-concreto-en-apenas)).
   The renter who calls first gets the viewing; agencies rarely answer email or portal
   messages, and the call happens in Spanish or Catalan, during office hours.

Our persona is **Jessie**, an international moving to Barcelona. She doesn't know barrio
price norms, can't spot a lightwell from listing photos, and can't call agencies in
Spanish during her workday. Every step of the funnel is stacked against her.

## Vision

Chezy is the agent on Jessie's side of the table. One chat surface: she states the brief
conversationally, sees a shortlist of real listings with the traps already flagged, and
approves the one she likes. Then chezy does the part nobody wants to do: it picks up the
phone, speaks Spanish, discloses that it is an AI assistant, agrees a viewing slot with
the agency, and drops the confirmed viewing on her calendar.

The listing works for the agency. Chezy works for the renter.

## Demo narrative

Canonical beat sheet; the contract for both the live demo and the Remotion video.

1. **Brief.** Jessie opens the chat: "Find me a bright 2-bed in Gràcia under €1,800."
   Onboarding resolves her identity and fills missing profile fields conversationally
   (areas, budget, bedrooms), then invites free-form requirements.
2. **Shortlist.** The assistant searches the Barcelona listings dataset and renders
   result cards in the chat.
3. **Forensic debunk.** One card carries an amber warning: "0% direct sunlight, windows
   onto a 1.5 m lightwell, 13% over the barrio average." A second card passes. This is
   the product's core claim made visible.
4. **Approval.** Jessie likes the passing card and taps "call the agency."
5. **The call.** A voice agent (SLNG + Vonage telephony) dials the agency, speaks
   Spanish, opens with the AI disclosure, and agrees a viewing slot. On stage the call
   goes to a controlled +34 number, not a live agency.
6. **Booked.** The confirmed slot comes back, a Google Calendar event is created, and
   the chat confirms the time.

Beats 5 and 6 have mock fallbacks (`VIEWING_MODE`, `CALENDAR_MODE`) so the demo never
blocks on telephony. The Radar swipe-deck variant of beats 3 to 5 is specified in
`.agents/docs/screens/radar.md` (UI dropped in PR #6, rebuild contract kept).

## Goals

Demo-day assertions, in order:

1. **The loop closes live.** Brief → shortlist → forensic flag → approval → dispatched
   call → booked calendar event. If any link is missing, there is no demo.
2. **The forensic finding is real.** The flag shown comes from listing data (sunlight
   class, price vs barrio average), not narration.
3. **The call reaches a real phone.** A controlled +34 number, in Spanish, with the AI
   disclosure (EU AI Act art. 50).
4. **Identity persists.** Jessie's profile survives a fresh session via the
   username-keyed user row.

Secondary: the repo reads well as a portfolio piece (enforced gates, atomic commits,
per-package AGENTS.md), and the pipeline is tenure-agnostic even though the story is
rental.

## Scope

- **Geography:** Barcelona city only (`COVERAGE_CITY` in `apps/web/lib/constants.ts`).
  The agent declines other cities and steers back.
- **Tenure:** the canonical story is rental. The dataset also contains sale listings;
  nothing in the schema blocks them.
- **Call target on stage:** a controlled +34 number. A real agency call is a bonus,
  never the demo path.
- **Language:** chat is English-first; the outbound call is Spanish.

## Non-goals

- Other cities, other countries.
- The buy flow as a story (dataset coverage is incidental).
- Real auth. Username-keyed identity is unauthenticated by design for the demo.
- Live GIS / commute distance matrices.
- Deposits, contracts, payments, price negotiation.
- Calling a real agency on stage.
- Multi-tenant or multi-user hardening, rate limits, production ops.
- Listing freshness guarantees. The dataset is a static 300-listing snapshot.
- Native or mobile app.

## Hackathon tracks

Updatable as we enter more.

Evidence status per track is assessed in
`.agents/notes/2026-09-20-hackbarna-tracks.md`; challenge requirements come from
`docs/hackbarna.md`.

| Track | What chezy uses | Status |
| --- | --- | --- |
| SLNG (+ unmute) | Voice agent authored with unmute, deployed as a managed SLNG agent on LiveKit SIP | Agent pinned `eu-central`/`livekit`, trunk attached; missing recorded call + latency/cost numbers |
| Vonage | Voice API telephony: PSTN leg to the agency, SIP bridge to SLNG | Live test call completed (~EUR 0.015); prize needs the Video API, not Voice |
| Nebius AI Studio | Chat, title, vision and embedding models via `@ai-sdk/openai-compatible` | Default provider, `DeepSeek-V4.1-Flash`; missing measurable-improvement run |
| QualityClouds (Norma) | Deterministic checks on the repo (portal Full Scan + MCP) | Scan → fix → rescan complete: 62 → 67/100 Conditional |
| Galtea | Adversarial evals via `apps/evals` + `apps/web/scripts/galtea/` | Baseline run done, real failures found; fix + rerun + survey pending |
| Cognition (Devin) | Chezy Forge: API-driven Devin sessions write portal adapters; pytest + pydantic + hidden hold-outs + path allowlist decide; failures fed back into the session (`scripts/devin-forge`) | 2 runs, 3 PRs merged (#66, #70, #71); run 2 caught a live-page crash and Devin fixed it on retry. Notes: `.agents/notes/2026-09-20-devin-forge-run.md` |
| Mastra | Telegram bot `@hackbarna_chezybot` (`apps/bot`, Mastra + polling) | Live since 11:27; PR #53 open; submit handle by 12:00, keep alive to 17:30 |

Note: the Vonage prize track requires the Video API. Our use is telephony plumbing, not
a prize play, unless a Video surface is added.

## Layers

Milestone names reused from the codebase so backlog items map cleanly.

- **Layer 0 (shipped):** the closed demo loop on deterministic fixtures and mock modes.
  Chat onboarding, seeded listings search, viewing + calendar routes.
- **Layer 1 (in flight):** live forensic calls, listings pipeline depth, the real SLNG
  call end to end, QualityClouds/Galtea evals.
- **Layer 2 (post-demo):** wildcard injection, busy-line fallback, live GIS, real auth,
  `apps/api` if the orchestration layer moves Python-side.

## Stack snapshot

| Layer | Choice |
| --- | --- |
| App | Next.js 16 + React 19 + AI SDK 7, verbatim `vercel/chatbot` import |
| LLM | Nebius AI Studio via OpenAI-compatible endpoint |
| Voice | SLNG managed agent (unmute-authored) + Vonage Voice API |
| Data | Drizzle + postgres-js on pg0 (embedded Postgres 18 + pgvector) |
| Calendar | Google Calendar via service account |
| Scraper | uv-managed Python CLI (httpx + parsel + pydantic), idealista adapter |
| Dataset | 300 Barcelona listings (fotocasa / habitaclia / milanuncios), committed JSONL |

## Brand

- Logo: `assets/logo/`, source is `chezy-logo-1024.png` (1024x1024 PNG, transparent).
  Resized PNGs and `favicon.ico` live next to it; see `assets/README.md`.
- Palette: terracotta `#CA6A49` (roof/house), mint `#93C8AE` (chat bubble). The flow's
  `--color-ember` `#ff5a00` is a separate token, not yet reconciled with the palette.
- Typography: Outfit for headings and display, DM Sans for UI and body/long reading.
  Both are variable fonts under OFL 1.1, in `assets/fonts/`.
- Wiring: `apps/web` root layout via `next/font/local` and `apps/video` `theme.ts` via
  `@remotion/fonts` (PR 2).

## References

- `docs/hackbarna.md`: the event brief — schedule, sponsor challenges and judging
  criteria, prizes, submission process.
- `.agents/docs/screens/radar.md`: dual-view demo spec and rebuild contract.
- `assets/README.md`: brand assets (logo sizes, fonts, how to load them).
- `.agents/plans/`: layer0, listings data, onboarding, voice telephony.
- `.agents/MEMORY.md`: stack snapshot and non-obvious decisions.
- `AGENTS.md`: enforced gates and conventions.
