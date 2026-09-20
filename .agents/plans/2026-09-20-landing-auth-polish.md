# Landing + auth surface polish (demo-grade, mobile-first)

Branch: `feat/chezy-0/landing-auth-polish` off `origin/main` (`32d1525`).

## Why

The demo is driven from a phone. Two surfaces undercut it:

1. `app/(auth)/*` is still the raw `vercel/chatbot` import: shadcn semantic tokens
   (different font and greys than the flow surface), a `SparklesIcon` placeholder mark,
   and a desktop-only side panel reading "Powered by ▲ Vercel AI Gateway". Anyone who
   taps Sign in during the demo leaves the Chezy brand entirely.
2. `app/(flow)/page.tsx` is a desktop two-column marketing block stacked on mobile: no
   product surface, no motion, no proof. It reads as a template hero, not as an app.

There is also a real routing bug: `/register` signs the user in and calls
`router.refresh()`, and `proxy.ts` then bounces the now non-guest user to `/`. Register
dead-ends on the landing page instead of entering onboarding.

## Scope

Landing and auth only. Onboarding, explore and match are untouched so the QA already
done on JES-7/8/10/11 does not regress.

## Decisions

- **Register is the funnel.** Landing CTA → `/register` → server-side `redirect("/onboarding")`.
  `/login` → `redirect("/explore")` (which itself redirects to `/onboarding` when the
  user has no profile, so both entries converge).
- **Guest escape stays.** A low-key "Explore as a guest" link under the auth card points
  at `/onboarding`, not `/api/auth/guest`: the proxy already mints a guest token on first
  request, and the guest route bounces an existing token to `/`. Keeps the stage demo
  free of typing credentials.
- **Motion is CSS-only and deterministic.** Particle positions/delays are a hardcoded
  table, never `Math.random()` at render — the `FlowReveal` hydration mismatch from #39
  is a warning not to introduce client/server divergence. Only `transform`/`opacity`
  animate, so it stays on the compositor on a phone. Disabled under
  `prefers-reduced-motion` in the existing reduce block.
- **No new dependencies**, no canvas, no images (there is no property photography in
  `public/`).
- **Honesty.** The landing agent card is labelled `Example` and its footer states nothing
  is called or booked without approval, matching the demo package's truthful-state rule.
  The one hard number on the page is a live `countRentCandidates({})` read, wrapped in
  Suspense and degraded to `—` on failure.

## Changes

New:

- `components/flow/ui/SignalField.tsx` — ambient layer: masked dot grid, soft ember
  glow, 8 drifting dots. `aria-hidden`, `pointer-events-none`, server component.
- `components/flow/ui/HomeSignalMark.tsx` — stroke-only façade/window glyph with one
  ember node. The "housing + AI" mark for landing nav and auth card.
- `components/flow/landing/AgentActivityCard.tsx` — example agent feed (filtered →
  matched → simulated viewing).
- `components/flow/auth/AuthCard.tsx` — shared auth card shell on flow tokens.
- `components/flow/auth/AuthFields.tsx` — flow-token email/password fields + submit
  button driven by `useFormStatus`.

Modified:

- `app/(flow)/page.tsx` — mobile-first rebuild.
- `app/(auth)/layout.tsx`, `login/page.tsx`, `register/page.tsx` — flow-branded; errors
  render inline from `useActionState` state (derived, no `useEffect`, no toast).
- `app/(auth)/actions.ts` — `redirect()` after a successful sign-in, called outside the
  try/catch so `NEXT_REDIRECT` is not swallowed.
- `app/globals.css` — `signal-drift` / `signal-pulse` keyframes in the flow `@theme`
  block plus entries in the existing reduced-motion block.
- `tests/e2e/auth.test.ts` — updated for the new copy, plus guest-link and
  register→onboarding coverage.

Deleted:

- `components/chat/auth-form.tsx`, `components/chat/submit-button.tsx` — only ever
  referenced by the two auth pages; unreferenced after this change.

## Verification

- `mise run validate` (typecheck, oxlint, oxfmt, vitest).
- `pnpm build` in `apps/web`.
- Playwright `tests/e2e/auth.test.ts` plus a manual 375px pass over
  `/` → `/register` → `/onboarding`, `/login`, and the guest link.
- Reduced-motion pass: particles must be static.
