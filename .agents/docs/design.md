# Design

> Visual + UX constraints for chezy. Linked from `AGENTS.md` and from the repo root as
> `DESIGN.md`. This is the design system as of day 0 — extend it as the product grows.

## Day-0 design thesis

Chezy is a 0→1 hackathon demo of a chat-centric AI webapp. The design thesis is:

- **Quiet surface, loud AI.** The chrome (chrome of the chat surface — sidebar, header,
  model picker) is monochrome and small. The AI's output (text, tool calls, artifacts)
  is what the user looks at.
- **Tokens, not magic numbers.** Every spacing, color, and font size comes from a token
  in `apps/web/styles/tokens.css`. Don't hardcode `16px` or `#1a1a1a` in a component.
- **Reasoned defaults.** shadcn/ui + Radix provide the accessible primitives. Tailwind 4
  utility classes compose them. Valibot schemas back every form.

## Color palette (day 0)

We're starting with the default shadcn/ui neutral + a single accent. Tokens live in
`apps/web/styles/tokens.css` and are mapped to Tailwind via the `@theme` directive.

| Token | Default | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `#fafafa` | `#0a0a0a` | App background |
| `--foreground` | `#0a0a0a` | `#fafafa` | Body text |
| `--muted` | `#f4f4f5` | `#1c1c1e` | Subtle backgrounds (chips, sidebars) |
| `--muted-foreground` | `#71717a` | `#a1a1aa` | Secondary text (timestamps, model names) |
| `--border` | `#e4e4e7` | `#27272a` | Hairlines |
| `--accent` | `#3b82f6` | `#60a5fa` | Primary CTA, link, focus ring |
| `--destructive` | `#ef4444` | `#f87171` | Destructive actions |

When you add a new color (success, warning, info), add a token first, then map it to a
Tailwind utility in `apps/web/styles/tokens.css`.

## Typography

- Sans: the shadcn default (Inter on the web; system stack as a fallback).
- Mono: JetBrains Mono (or system mono fallback).
- We do not bundle custom fonts on day 0. If a future ticket needs brand-distinct
  typography, plan for `next/font` + woff2 subsetting via the same `build:assets` task
  brioso uses.

| Use | Class | Size / line |
| --- | --- | --- |
| Page title | `text-2xl font-semibold` | 24 / 32 |
| Section heading | `text-lg font-semibold` | 18 / 28 |
| Body | `text-sm` | 14 / 20 |
| Mono / code | `font-mono text-sm` | 14 / 20 |
| Caption / timestamp | `text-xs text-muted-foreground` | 12 / 16 |

## Spacing scale

Tailwind's default 4px scale (`p-2` = 8px, `p-4` = 16px, etc.). Don't invent custom
spacing values.

| Use | Class |
| --- | --- |
| Tight stack (chips, list items) | `gap-1` / `gap-2` |
| Form fields | `gap-3` |
| Sections | `gap-6` |
| Page padding | `px-4 py-6 md:px-8` |

## Layout

Three regions, all of which are mobile-first:

```
┌──────────────────────────────────────────────┐
│  Header  (model picker, user menu, share)    │  h-14
├──────────────────────────────────────────────┤
│                                              │
│  Conversation area                           │
│  (scrolling, max-w-3xl centered, gap-6)      │
│                                              │
├──────────────────────────────────────────────┤
│  Composer  (textarea + send + attach)        │  pt-2 pb-4
└──────────────────────────────────────────────┘
```

A side panel (chat history, artifact tree) lives in a `<Sheet>` on mobile and a fixed
`<aside>` on `lg:` screens. We don't ship a fixed sidebar on day 0.

## Motion

- Default transitions: 150 ms ease-out for hover, 200 ms for drawer/modal open.
- No animations on layout (no `framer-motion` on day 0). Use Tailwind `transition` /
  `animate-*` utilities and Radix's built-in `data-state` transitions.
- Streaming text renders without animation; tool-call expansion collapses 200 ms ease-out.

## Voice and tone

- CLI-facing copy: short, lowercase, no exclamation points. `mise run db:start`, not
  `Mise Run Database Start!`.
- UI-facing copy: friendly, neutral, second person. "Send a message", not "Submit your
  prompt".
- Error messages: state what went wrong + what the user can do. "Couldn't reach
  Postgres. Is `pg0` running? Try `mise run db:start`."

## Anti-patterns

These are explicit no-gos:

- ❌ Gradients on cards (looks like AI slop).
- ❌ Drop shadows on hover that change elevation (jarring, dated).
- ❌ Inline emoji in headings.
- ❌ Colored backgrounds on the entire page.
- ❌ Animated background blobs.
- ❌ Custom font loaders that block first paint.

## Accessibility floor

- Every interactive element has a visible focus ring (`focus-visible:ring-2`).
- Color contrast ≥ 4.5:1 for body text (default Tailwind neutral passes; verify before
  adding a new color).
- All forms have labels; the chat composer's textarea has a placeholder + `aria-label`.
- Modals and sheets trap focus; Radix handles this by default — don't override.

## What lives in this doc vs the lint rules

This doc is **advisory**. The lint rules in `.oxlintrc.json` are **enforced**. Conflicts
between this doc and the lint rules are resolved by the lint rules. If you find
yourself wanting to violate a rule for a design reason, write a plan in
`.agents/plans/` first.
