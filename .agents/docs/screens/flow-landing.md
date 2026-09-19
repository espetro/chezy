# Screen: landing page (`/`, formerly `/flow`)

Static, server-rendered hero at the product root (the `/flow` prototype was promoted to
`app/(flow)/` 2026-09-19; `/flow` redirects to `/`). No client state, no data
fetching. Palette is the "Chezy style reference" editorial system (obsidian/ember, DM Sans,
36px card radius, `apps/web/app/globals.css`'s flow token block) — deliberately separate
from the chat's shadcn tokens; see `.agents/plans/2026-09-19-port-to-main.md` for why.

## ASCII mockup

Header: wordmark left, single CTA right, no border (floats on canvas).

```
+------------------------------------------------------------------+
|  chezMoi                                          [ Get started ] |
+------------------------------------------------------------------+
```

Hero — two columns on `md:` and up:

```
+-----------------------------------+  +----------------------------+
| [ Rental agent ]  <- ember pill    |  | WITHOUT AN AGENT           |
|                                     |  |                            |
| Find your next home without        |  | -> No more endless         |
| chasing it yourself                |  |    scrolling on listing    |
|   (56-64px, weight 600, obsidian)  |  |    sites — the agent       |
|                                     |  |    filters for you         |
| Describe what you're looking for   |  |                            |
| once. chezMoi tracks inventory     |  | -> The agent writes and    |
| from partner agencies, scores      |  |    sends the first         |
| every listing against your         |  |    contact to the agency   |
| profile, and handles the first     |  |                            |
| contact — you approve what         |  | -> You approve before any  |
| matters.                           |  |    irreversible step       |
|                                     |  |                            |
| [ Find my home ] [ See an example  |  +----------------------------+
|                     match ]        |
+-----------------------------------+
```

^ Left column: `FlowButton` primary (obsidian fill) + `FlowButton` secondary (white/mist
border). Right column: `bg-slate` (#27272a) card, white text, ember `→` glyph per bullet.

## Behavior

- `FlowLandingPage` (`apps/web/app/(flow)/page.tsx`) is a plain function component, no
  `"use client"`, no hooks.
- Header "Get started" and hero "Find my home" both link to `/onboarding`; "Talk to your
  agent" links to `/chat`. "See an example match" links straight to `/explore`, skipping
  onboarding.

## Responsive

- `grid md:grid-cols-2` — stacks to a single column below `md:`.
- Page shell: `max-w-[1200px]` centered, `px-6 py-16 md:px-8`.

## Notes

- Component: `apps/web/app/(flow)/page.tsx`; UI primitives: `apps/web/components/flow/ui/
  {Button,Pill}.tsx` (named `FlowButton`/`FlowPill`, not `Button`/`Pill` — the app's real
  shadcn components already own those names at `apps/web/components/ui/*`).
- The root routes are session-gated by `apps/web/proxy.ts` like everything else: a
  sessionless visit bounces through `/api/auth/guest` once, then renders.
- Ported from a standalone prototype 2026-09-19; see `.agents/plans/2026-09-19-port-to-main.md`
  for what changed during the port (route namespace, token isolation, `@/*` alias, reused
  `@chezy/ui`'s `useMountEffect` and `@/lib/utils`'s `cn`).

## User flow checkpoints

```
entry (/) -> "Find my home" or header "Get started" -> /onboarding
          -> "See an example match" -> /explore
          -> "Talk to your agent" -> /chat
```
