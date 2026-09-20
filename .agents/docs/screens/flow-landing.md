# Screen: landing page (`/`, formerly `/flow`)

Server-rendered hero at the product root (the `/flow` prototype was promoted to
`app/(flow)/` 2026-09-19; `/flow` redirects to `/`). Palette is the "Chezy style reference"
editorial system (obsidian/ember, DM Sans + Outfit headings, 36px card radius,
`apps/web/app/globals.css`'s flow token block) — deliberately separate from the chat's
shadcn tokens; see `.agents/plans/2026-09-19-port-to-main.md` for why.

Rebuilt mobile-first 2026-09-20 (`.agents/plans/2026-09-20-landing-auth-polish.md`): the
demo is driven from a phone, so the page is designed at 375px and widens to two columns,
not the other way round.

## ASCII mockup

Sticky header on a hairline border: mark + wordmark left, ghost `Sign in` and a pill
`Get started` right.

```
+------------------------------------------------------------------+
|  [#] Chezy                             Sign in   ( Get started )  |
+------------------------------------------------------------------+
```

Hero — single column on a phone, two columns on `md:` and up:

```
+-----------------------------------+  +----------------------------+
| ( AI rental agent · Barcelona )    |  | [#] Chezy agent  [Example] |
|                                     |  | Watching partner listings  |
| Find your next home without        |  |                            |
| chasing it yourself                |  | [=] 14 listings filtered   |
|   (34px phone / 56px desktop)      |  |     Gràcia · under 1.400 € |
|                                     |  |                            |
| Describe what you are looking for  |  | [*] Match 96%      Calling |
| once. Chezy watches partner        |  |     Carrer de Verdi · 78m² |
| inventory, scores every listing…   |  |                            |
|                                     |  | [@] Viewing simulated  1h  |
| [ Create your account -> ]         |  |     No call placed         |
| [ Explore as a guest ]             |  |                            |
| About a minute to set up · nothing |  | Example of the agent feed. |
| is called or booked without your   |  | Chezy never calls…         |
| approval                           |  +----------------------------+
+-----------------------------------+
```

Below the hero: a two-up stat row, then a `bg-slate` "How Chezy works" block with three
numbered steps and a closing CTA.

```
+----------------------+  +----------------------+
| 150                  |  | 95%                  |
| rental listings      |  | match score where    |
| tracked right now    |  | Chezy calls on its   |
+----------------------+  +----------------------+
```

## Behavior

- `FlowLandingPage` (`apps/web/app/(flow)/page.tsx`) has no `"use client"` and no hooks.
- Header `Get started` and hero `Create your account` link to `/register`, which redirects
  into `/onboarding` on success (see `app/(auth)/actions.ts`). Header `Sign in` links to
  `/login`, which redirects to `/explore`.
- `Explore as a guest` links straight to `/onboarding`. It exists so the live demo never
  has to type credentials; the proxy has already minted a guest token by then.
- The `150` tile is a live `countRentCandidates({})` read inside its own `<Suspense>`
  boundary, so the route is partially prerendered: static shell, streamed number,
  `—` if the database is unavailable.
- The agent card is an **example**, labelled as such in the header pill and disclosed in
  the footer. It must never be worded as live activity or as a booking.
- `FlowChatLauncher` (from `app/(flow)/layout.tsx`, PR #50) floats bottom-right here too.

## Responsive

- `grid md:grid-cols-2` — stacks to a single column below `md:`.
- Page shell: `max-w-md` on a phone, `max-w-[1200px]` from `md:`, `px-4 sm:px-6`.
- No horizontal overflow at 375px; every control is ≥44px tall (asserted in
  `tests/e2e/flow-happy-path.test.ts` via `expectNoHorizontalScroll`).

## Motion

`SignalField` (`components/flow/ui/SignalField.tsx`) is the ambient layer: a masked dot
grid, one soft ember glow, and eight drifting dots. Positions and delays are a hardcoded
table so the server and client render identical DOM. Only `transform`/`opacity` animate.
`prefers-reduced-motion: reduce` stops every particle (globals.css reduce block).

## Notes

- Component: `apps/web/app/(flow)/page.tsx`; card: `components/flow/landing/AgentActivityCard.tsx`;
  primitives: `components/flow/ui/{Button,Card,Pill,HomeSignalMark,SignalField}.tsx`
  (named `FlowButton`/`FlowPill`, not `Button`/`Pill` — the app's real shadcn components
  already own those names at `apps/web/components/ui/*`).
- Links that look like buttons use `flowButtonClass` rather than wrapping a `FlowButton`
  in a `Link`: a `<button>` inside an `<a>` is invalid HTML.
- The root routes are session-gated by `apps/web/proxy.ts` like everything else: a
  sessionless visit bounces through `/api/auth/guest` once, then renders.
- Ported from a standalone prototype 2026-09-19; see `.agents/plans/2026-09-19-port-to-main.md`
  for what changed during the port (route namespace, token isolation, `@/*` alias, reused
  `@chezy/ui`'s `useMountEffect` and `@/lib/utils`'s `cn`).

## User flow checkpoints

```
entry (/) -> "Create your account" or header "Get started" -> /register -> /onboarding
          -> "Explore as a guest" -> /onboarding
          -> header "Sign in" -> /login -> /explore
          -> chat launcher (bottom right) -> embedded chat drawer
```
