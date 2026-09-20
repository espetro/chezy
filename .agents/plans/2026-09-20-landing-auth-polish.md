# Auth surface polish (demo-grade, mobile-first)

Branch: `feat/chezy-0/landing-auth-polish` off `origin/main` (`32d1525`), synced with
main after PR #55.

## Why

The demo is driven from a phone. `app/(auth)/*` was still the raw `vercel/chatbot`
import: shadcn semantic tokens (different font and greys than the flow surface), a
`SparklesIcon` placeholder mark, and a desktop-only side panel reading "Powered by Vercel
AI Gateway". Anyone who taps Sign in during the demo leaves the Chezy brand entirely.

There was also a real routing bug: `/register` signed the user in and called
`router.refresh()`, and `proxy.ts` then bounced the now non-guest user to `/`. Register
dead-ended on the landing page instead of entering onboarding.

## Scope

Auth screens, the sign-in / sign-up redirects, and two small landing touches (hero
entrance, link buttons). Onboarding, explore and match are untouched so the QA already
done on JES-7/8/10/11 does not regress.

A first revision of this branch also rebuilt the landing page (ambient particle field,
example agent feed card, stat tiles, sticky header with Sign in / Get started). A phone
review found the motion imperceptible and the account CTAs confusing for a hackathon
demo whose only real entry is the guest path, so that part was dropped and the landing
stays as on main.

## Decisions

- **Guest is the funnel.** The landing keeps main's `Find my home` → `/onboarding` and
  `See a match in action` → `/explore`. It does not link to `/login` or `/register`.
- **Auth redirects are server-side.** `/register` → `redirect("/onboarding")`, `/login` →
  `redirect("/explore")` (which itself redirects to `/onboarding` when the user has no
  profile, so both entries converge). `redirect()` runs outside the try/catch so
  `NEXT_REDIRECT` is not swallowed.
- **Guest escape stays on the auth screens.** A low-key "Explore as a guest" link under
  the auth card points at `/onboarding`, not `/api/auth/guest`: the proxy already mints a
  guest token on first request, and the guest route bounces an existing token to `/`.
- **Hero motion is CSS-only.** The existing `animate-fade-up` keyframe with a 70 ms
  stagger. Motion renders `initial` into the server HTML and leaves the hero blank until
  hydration, which is the wrong failure mode for the first screen on conference wifi.
  Disabled under `prefers-reduced-motion` in the existing reduce block.
- **One brand mark.** The auth card reuses `FlowAgentMark`, the mark the chat launcher
  already uses. No second glyph.
- **No new dependencies.** `framer-motion` is removed in favour of the already present
  `motion` package.

## Changes

New:

- `components/flow/auth/AuthFields.tsx`: flow-token email/password fields + submit
  button driven by `useFormStatus`.

Modified:

- `app/(auth)/layout.tsx`, `login/page.tsx`, `register/page.tsx`: flow-branded; errors
  render inline from `useActionState` state (derived, no `useEffect`, no toast).
- `app/(auth)/actions.ts`: `redirect()` after a successful sign-in, outside the try/catch.
- `app/(flow)/page.tsx`: CTAs use `flowButtonClass` on the `Link` instead of nesting a
  `FlowButton` inside it; hero children carry `animate-fade-up` with a stagger.
- `components/flow/ui/Button.tsx`: exports `flowButtonClass`.
- `components/chat/*`: `framer-motion` imports moved to `motion/react`.
- `tests/e2e/auth.test.ts`: new copy, guest link from the auth screen, register →
  onboarding regression, short password error.

Deleted:

- `components/chat/auth-form.tsx`, `components/chat/submit-button.tsx`: only ever
  referenced by the two auth pages; unreferenced after this change.

## Verification

- `mise run validate` (typecheck, oxlint, oxfmt, vitest).
- `pnpm build` in `apps/web`.
- Playwright `tests/e2e/auth.test.ts`, `flow-happy-path`, `flow-chat-launcher`, plus a
  phone pass over `/`, `/login`, `/register` → `/onboarding` and the guest link.
