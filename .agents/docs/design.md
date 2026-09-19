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

---

# Flow design system (Stitch "Chezy AI Rental Platform", 2026-09-19)

Everything above describes the chat app. The product surface — `/`, `/onboarding`,
`/explore`, `/explore/[id]` in `app/(flow)` (the `/flow/*` prototype, promoted to the root
2026-09-19) — uses a separate system derived from the Chezy style reference
and the Stitch project's **Preferencias** screen. Tokens live in the delimited flow
`@theme` block at the bottom of `apps/web/app/globals.css`; every token there is a **new
name** (never `--background`, `--primary`, `--secondary`, …) so the flow can't reskin the
chat. Components live in `apps/web/components/flow/ui/` and are `Flow*`-prefixed.

## Palette

| Token | Value | Role |
|---|---|---|
| `obsidian` `#09090b` | dominant ink, primary CTA fill, selected states |
| `graphite` `#18181b` / `iron` `#3f3f46` / `steel` `#52525b` / `fog` `#71717a` / `ash` `#a1a1aa` | text ramp, darkest → placeholder |
| `mist` `#d4d4d8` / `cloud` `#ececee` | tracks, unchecked boxes, dividers |
| `paper` `#f4f4f5` | canvas **and** recessed inputs/tiles inside white cards |
| `snow` `#ffffff` | cards, bubbles, thumbs |
| `card-subtle` `#fafafa` | hover fills |
| `ember` `#ff5a00` | the single accent: badges (`bg-ember/10 text-ember`), status dots, slider fill, selected must-have icon |
| `ember-deep` `#a83900` / `ember-soft` `#ffdbcf` | dealbreaker ("auto-discard") accents — Stitch's `secondary`/`secondary-fixed`, renamed because `--color-secondary` already belongs to the chat's shadcn tokens |

## Elevation (differs from the chat app above)

- **Surfaces float on soft shadow, not hairlines**: cards, bubbles, section cards are
  `bg-snow shadow-sm` with **no border**. `hover:shadow-md` only on cards that are links.
- **Controls are recessed, not outlined**: inputs, tiles, chips, rows, the budget panel
  are `bg-paper` on the white card, no border. Focus = `ring-2 ring-obsidian`.
- Hairline `border-cloud` survives only as an inline divider (e.g. the "To:" row of the
  contact draft) and on outline tag pills.

## Type scale (`text-*` utilities)

| Utility | Size / line | Weight | Use |
|---|---|---|---|
| `text-label-sm` | 11 / 16, +0.04em | 600 | eyebrows, field labels (as `text-steel`), badges |
| `text-label-md` | 13 / 18 | 500 | chips, selector options, live value ("Max 25 min by metro") |
| `text-body-default` | 14 / 20 | 400 | bubbles, descriptions |
| `text-body-medium` | 14 / 20 | 500 | input text, tile values, CTA |
| `text-headline-sm` | 18 / 26, −0.01em | 600 | section card titles ("1. Routine & area") |
| `text-headline-md` | 24 / 32, −0.015em | 600 | reserved (page titles) |

Radii by role: section card 32, mini/alerts card 28, bubble 24 (`rounded-tl-sm` on the
agent side, `rounded-tr-sm` on the user side), budget panel 20, tiles & rows 18, inputs /
CTA / date chips 14, segmented options 12, checkbox 6, chips `full`.

Icons: `lucide-react` (no Material Symbols). Mapping used: `Bot` avatar, `Navigation`,
`Wallet`, `Calendar`, `BadgeCheck`, `Shield`, `Ban`, `TriangleAlert`, `UserX`, `Sun`,
`Umbrella`, `ArrowUpDown`, `Snowflake`, `Sofa`, `PawPrint`, `BedDouble`, `Scaling`,
`Briefcase`, `BellRing`, `ArrowRight`, `Check`, `Minus`/`Plus`.

## Interaction components

All keyboard-operable, `focus-visible:ring-2 ring-obsidian`, 200ms color transitions, no
`useEffect`. File = `apps/web/components/flow/ui/<Name>.tsx`, export `Flow<Name>`.

**SectionCard** — one numbered section per onboarding step.
```
+--------------------------------------------------------------+
| (icon) 1. Routine & area                     [ High priority ] |  <- 28px paper disc,
|                                                                |     headline-sm, aside slot
|  ...children...                                                |
+--------------------------------------------------------------+
   bg-snow rounded-[32px] p-5 shadow-sm; `iconTone="deep"` = ember-soft/ember-deep disc
```

**Stepper** — sticky top; "GETTING STARTED" on step 0, else "STEP N OF 7".
```
 • STEP 2 OF 7                                   Budget & space
 [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   h-1 cloud track, obsidian fill
   role=progressbar aria-valuenow/max
```

**TextField** — label above, leading icon, recessed.
```
 Work or study address you commute to           <- text-label-sm text-steel
 [ (briefcase)  Diagonal 405 (Passeig de Gràcia), BCN        ]   h-12 bg-paper rounded-[14px]
                                                                  focus:bg-snow
```

**SegmentedSelector** — single choice, radiogroup with roving tabindex + arrow keys.
```
 Max commute time                          Max 25 min by metro   <- live value, label-md 600
 [  15 min  ] [■ 25 min ■] [  40 min  ]     rounded-[12px]; selected = obsidian/snow
```

**ToggleChipGroup** — multi-select chips, `aria-pressed`, check icon reserves width.
```
 Target neighborhoods
 (■ Eixample ✓) (■ Gràcia ✓) ( Poblenou  ) ( Sant Antoni  ) ...
```

**RangeSlider** — two overlaid native `<input type=range>` on one track.
```
 +----------------------------------------------------------+
 | Monthly range                          €800 — €1,200     |
 |  ────────●━━━━━━━━━━━━━━━━●──────────────────────────    |  cloud track, ember fill,
 |  €600           Area average: €1,150            €2,000+  |  20px snow thumbs w/ ember dot
 +----------------------------------------------------------+
   bg-paper rounded-[20px] p-3.5; aria-label "Minimum/Maximum monthly range", aria-valuetext
```

**StatTile** — value stepper (bedrooms, min m²).
```
 [ (bed)  Bedrooms                                 (−) (+) ]   bg-paper rounded-[18px] p-3
 [        2 bedrooms                                       ]   value is aria-live
```

**DateChips** — radiogroup; "Pick a date" reveals a `<input type=date>` TextField.
```
 [   Pick a date   ] [■ Flexible ±15 days ■]     rounded-[14px] flex-1
```

**SelectableTile** — 2-col must-have toggles, `aria-pressed`.
```
 [ (sun•) Natural light                 (✓) ]  [ (❄)  Air conditioning        ( ) ]
   selected: ember icon, obsidian text, obsidian check disc; else fog/steel, cloud disc
```

**CheckboxRow** — native checkbox wrapped in a `<label>` row; dealbreakers.
```
 [ (⊘) No dark ground floors or interior-facing units      [✓] ]  bg-paper rounded-[18px]
   ember-deep icon; 20px rounded-[6px] box, obsidian when checked
```

**Switch** — `role=switch`, 44×24 track, 20px thumb.
```
 Real-time alerts                                [ Active ] (●━)
 Chezy will notify you via push & WhatsApp
```

**StickyActionBar** — bottom of every onboarding step; the only CTA on screen.
```
 +--------------------------------------------------------------+
 | • 2 listings match right now                      94% match  |  pulsing ember dot, aria-live
 | [                  Continue  →                              ] |  h-12 obsidian, active:scale-[0.99]
 +--------------------------------------------------------------+
   sticky bottom-0 bg-snow/90 backdrop-blur-md; disabled = 40% opacity
```

**ChatBubble (agent)** — 40px `Bot` avatar with ember status dot, name row
("Chezy AI · Personal agent"), `rounded-[24px] rounded-tl-sm shadow-sm`, optional meta
row of pills. User side: obsidian, `rounded-tr-sm`, right-aligned.

Live counter logic is not a component: `OnboardingFlow` debounces `updatePreferences`
into `GET /api/profile/count` (300 ms, `useRef` timer — no effect, no store) and renders
the result in the sticky bar.
