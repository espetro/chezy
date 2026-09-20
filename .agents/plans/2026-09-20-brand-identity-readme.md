# Brand identity + marketing README

Date: 2026-09-20 (demo day, 11:00 CEST). Tracking: none for the hackathon (user decision).
Branches use `feat/chezy-0/<slug>`.

## Context found

- `main` is at `1f8abaf` (fast-forwarded 174 commits this morning). Working tree clean.
- The 239-file diff on `feat/chat-onboarding` was a mechanical `@/` to `~/` alias codemod on a
  stale branch. `main` already did that migration (`apps/web/tsconfig.json` maps `~/*`, 0
  `@/` imports left, `vendor/` deleted). Stashed as
  `stash@{0}: accidental-alias-codemod-@-to-~-apps-web-2026-09-20`; safe to `git stash drop`.
  Two stale untracked files (`uv.lock`, `.agents/plans/2026-09-19-demo-video.md`) were parked
  in `/tmp/chezy-parked-2026-09-20/`; both exist on `main` (plan identical, lock older).
- Fonts today: root layout loads Geist + Geist Mono from Google; `(flow)/layout.tsx` loads
  DM Sans from Google as `--font-dm-sans`, mapped to `--font-flow` in `globals.css`.
  `apps/video/src/theme.ts` uses Inter (never loaded, falls back to system).
- Logo: `~/Downloads/chezy-logo.png`, 1024x1024 RGBA, transparent background. Sampled
  palette: terracotta `#CA6A49` (house), mint `#93C8AE` (chat bubble). The flow's existing
  `--color-ember` (`#ff5a00`) is a different, hotter orange; NOT retokened in this plan.
- Fonts zip: Outfit variable (`wght`, 110 KB) + DM Sans variable (`opsz,wght`, 239 KB) +
  DM Sans Italic variable (283 KB), both OFL 1.1. No woff2 tooling installed.
- No `LICENSE` file, no `assets/` dir, `docs/` holds only `prd.md` (no inbound references).
- Open PR #32 renames chezMoi to Chezy and touches `(flow)/layout.tsx` metadata. This plan
  does not touch `title`/`description` metadata to avoid conflicting with it.

## PR 1: `feat/chezy-0/brand-assets` (assets + PRD, no code)

Goal: logo + fonts on `main` within minutes so teammates can use them.

1. `assets/logo/`
   - `chezy-logo-1024.png` (source, copied), plus `magick`-resized
     `chezy-logo-{16,32,48,64,128,192,256,512}.png` (transparent, Lanczos).
   - `chezy-logo-apple-180.png`: 180x180 on opaque `#ffffff` (iOS composites no alpha).
   - `favicon.ico`: multi-size 16/32/48 from the PNGs.
2. `assets/fonts/outfit/` and `assets/fonts/dm-sans/`
   - Copy the 3 variable TTFs + each family's `OFL.txt`. Drop the static instances.
   - Convert each TTF to `.woff2` with fonttools (`uv tool install fonttools --with brotli`,
     then `fonttools ttLib.woff2 compress <ttf>`). Keep TTF + woff2 side by side.
3. `assets/README.md` (short): which logo size is for what, font roles (Outfit = headings,
   DM Sans = UI + long reading text), how to load them in web/video, OFL note.
4. `git mv docs/prd.md PRD.md`; delete the now-empty `docs/`. Add a `## Brand` section to
   `PRD.md`: logo path + palette, font pairing + roles, license, where wired
   (`apps/web/app/layout.tsx`, `apps/video/src/theme.ts`). Fix the `.agents/MEMORY.md`
   pointer if it references `docs/prd.md` (it does not today; verify).
5. Verify: `ls -la assets/**`, `magick identify` on each PNG, woff2 files open with
   `fonttools ttx -l`. No TS/Python touched, so `mise run validate:quick` is a formality.

Commits (atomic): `feat(brand): add chezy logo at all sizes`, `feat(brand): add Outfit and
DM Sans (OFL) as TTF + woff2`, `docs(prd): move PRD to repo root and add brand section`.

## PR 2: `feat/chezy-0/brand-fonts-wiring` (apps/web + apps/video)

Depends on PR 1 being merged.

### apps/web

1. Root `app/layout.tsx`: replace `Geist` (Google) with two `next/font/local` loaders:
   - `dmSans` from `../../../assets/fonts/dm-sans/DMSans-Variable.woff2` (+ italic as a
     second `src` entry with `style: "italic"`), `variable: "--font-dm-sans"`,
     `weight: "100 900"`.
   - `outfit` from `../../../assets/fonts/outfit/Outfit-Variable.woff2`,
     `variable: "--font-outfit"`, `weight: "100 900"`.
   - Keep `Geist_Mono` for code. Put all three variables on `<html>`.
   - Hypothesis to verify first: `next/font/local` resolving a path outside `apps/web`
     under Turbopack in a pnpm workspace. If it fails, fall back to copying the woff2 files
     into `apps/web/fonts/` (still sourced from `assets/`).
2. `app/globals.css`:
   - In the shadcn `@theme inline` block, point `--font-sans` at `var(--font-dm-sans)` and
     add `--font-heading: var(--font-outfit), ...` (check the existing `--font-sans` /
     `--font-mono` lines around line 385 first; mirror their fallback stacks).
   - Flow block: `--font-flow` keeps reading `var(--font-dm-sans)` (now injected at root).
   - Add `h1, h2, h3 { font-family: var(--font-heading) }` scoped via a `@layer base` rule,
     plus a `font-heading` utility via `--font-heading` in `@theme`.
3. `(flow)/layout.tsx`: remove the `DM_Sans` Google import and the `dmSans.variable`
   class; the root now provides it. Leave metadata untouched (PR #32).
4. Icons: replace `app/favicon.ico` with `assets/logo/favicon.ico`; add `app/icon.png`
   (512) and `app/apple-icon.png` (180 opaque) so Next emits the `<link>` tags. Leave
   `(chat)/opengraph-image.png` / `twitter-image.png` alone (template art; follow-up).
5. Apply Outfit where the flow renders headings: grep `components/flow/**` for the
   `text-headline-*` / display classes and add `font-heading`. Chat surface headings
   inherit from the `h1..h3` base rule only.

### apps/video

1. Add `@remotion/fonts@4.0.526` (must match `remotion` pin exactly).
2. Copy `assets/fonts/**/*.woff2` (3 files) to `apps/video/public/fonts/` (Remotion's
   `staticFile` needs `public/`). Add a one-line note in `apps/video/AGENTS.md` that
   `assets/fonts` is the source of truth.
3. `src/theme.ts`: `fontSans` -> `"'DM Sans', ...system stack"`, add
   `fontHeading: "Outfit, 'DM Sans', ...system stack"`. Keep `fontMono`.
4. New `src/fonts.ts`: `loadFont({ family: "DM Sans", url: staticFile("fonts/DMSans-Variable.woff2"), weight: "100 900" })`
   and the Outfit equivalent; call from `DemoComposition` (or `Root.tsx`) at module top
   level so Remotion waits on the promise (`@remotion/fonts` handles `delayRender`).
5. `IntroCard.tsx`: title + kicker use `theme.fontHeading`; add `<Img src={staticFile("logo/chezy-logo-512.png")}>`
   above the title (copy `assets/logo/chezy-logo-512.png` to `apps/video/public/logo/`).
   `Callout.tsx` and `Captions.tsx` headings use `fontHeading`.

### Verify

- `mise run validate:quick`, then `pnpm --filter @chezy/web typecheck` and
  `pnpm --filter @chezy/video typecheck`.
- Web: start dev server, confirm in devtools that `DM Sans` / `Outfit` woff2 are served
  and applied on `/` (flow landing) and `/chat`; check `<link rel="icon">` and apple-icon.
- Video: `mise run video:preview` (Remotion Studio) screenshot of the intro card with the
  logo and Outfit title.

Commits: `feat(web): self-host DM Sans and Outfit via next/font/local`,
`feat(web): use the chezy logo as favicon and app icons`,
`feat(video): load DM Sans and Outfit and show the logo on the intro card`.

## PR 3: `feat/chezy-0/marketing-readme` (README + `mise run setup`)

1. `mise.toml`: add `[tasks.setup]` = `wt:init` + `pnpm --filter @chezy/web db:migrate` +
   `mise run db:seed`, so the README install is three lines. (`wt:init` already copies
   `.env.example` to `apps/web/.env.local` if missing; the README states that the user's
   keys go there.)
2. Rewrite `README.md` in the dinov2.cpp / oxe / orca register, product not library:
   - Centered `assets/logo/chezy-logo-256.png` at width 128, `<h1 align="center">chezy</h1>`,
     tagline `Finding a flat, made easy.`, one-line pitch (PRD TL;DR), badges (hackathon
     Sept 2026, Next.js 16, Nebius AI Studio, SLNG, Vonage; no license badge until a
     LICENSE exists).
   - "Quickstart with agents": a paste-able prompt (dinov2.cpp style) that tells the user's
     agent to clone, `mise trust`, fill `apps/web/.env.local` from `.env.example` with the
     keys the user already has, run `mise run setup` then `mise run dev`, and open
     `http://localhost:3000`.
   - "Install" (manual): `mise trust`, `mise run setup`, `mise run dev`. One paragraph on
     env vars (`OPENAI_COMPATIBLE_*`, `CHEZY_*`, `POSTGRES_URL`, `VIEWING_MODE`,
     `CALENDAR_MODE`) pointing at `apps/web/.env.example`; no values.
   - "What it does" as the 6 demo beats (Brief, Shortlist, Forensic debunk, Approval, The
     call, Booked) in a two-column table; "Why" with the two Barcelona stats from the PRD.
   - "Built with" partner row using `apps/video/public/badges/*.png` (Nebius, SLNG,
     Vonage, Galtea, QualityClouds) and a compact stack table.
   - "Repo map" (5 lines), "Docs" (PRD.md, AGENTS.md, apps/web + apps/scraper + apps/video
     READMEs), "Brand" pointer to `assets/`.
   - Hero image: none committed yet (video is gitignored). Leave a TODO-free placeholder
     comment and add a screenshot in a follow-up once the demo UI settles.
   - Prose rules: no em dashes, no filler, no bold-label bullets (humanizer pass).
3. Move the current README's toolchain table and agent-facing details into `AGENTS.md`
   only if not already there (they are; just drop them from README).
4. Verify: render with `gh markdown-preview` or `glow`; check every relative link resolves
   (`assets/logo/...`, `PRD.md`, `apps/*/README.md`, `apps/video/public/badges/*`).

Commits: `chore(mise): add setup task`, `docs(readme): marketing-first rewrite with brand`.

## Follow-ups (not in scope today)

- Retoken flow `--color-ember` to the logo terracotta `#CA6A49` and add a mint token
  (`#93C8AE`) after the demo; needs a contrast check against the Stitch design.
- Vector logo (SVG) from the designer; PNG only for now.
- Replace template `opengraph-image.png` / `twitter-image.png` with logo-based art.
- Committed hero screenshot / GIF for the README.
- `git stash drop stash@{0}` once the user confirms.
- Root `AGENTS.md` still describes `apps/web` as a verbatim import with `@/*` and a
  `vendor/` copy; `apps/web/AGENTS.md` is the current truth. Reconcile.
