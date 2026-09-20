# 2026-09-20: brand identity + marketing README

PRs #41 (assets + PRD.md), #42 (README + `mise run setup`), #43 (font/logo wiring).
Plan: `.agents/plans/2026-09-20-brand-identity-readme.md`.

Things that surprised me:

- `next/font/local` resolves `../../../assets/fonts/*.woff2` (outside `apps/web`) under
  Turbopack in this pnpm workspace. No copy into `apps/web` needed. Remotion still needs
  copies in `apps/video/public/`; `assets/` is the source of truth.
- `main` never applied Geist: the variable was loaded but nothing in `globals.css` read
  `--font-geist`, so the chat surface rendered in the system font. `--font-sans` in
  `@theme inline` now points at DM Sans, so the whole app changed typeface in #43.
- The lefthook pre-push gate needs the worktree's own `node_modules` (`tsx`) even for
  asset-only branches; run `pnpm install --frozen-lockfile` in every new worktree first.
- `mise run validate` skips TS/Python when no such files changed vs `origin/main`, and
  `format:check` is part of it: run `oxfmt` on touched files before pushing.
- `magick -flatten` keeps the alpha channel; the opaque apple icon needed
  `-alpha remove -alpha off PNG24:`.
- The stale `feat/chat-onboarding` branch carried a 239-file `@/` to `~/` codemod that
  `main` already had. Stashed as `stash@{0}` in the main checkout; drop it.

Follow-ups: retoken flow `--color-ember` (#ff5a00) and the video `accent` blue to the logo
palette (terracotta #CA6A49, mint #93C8AE); SVG logo; OG/Twitter images; README hero
screenshot.
