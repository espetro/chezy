# Screen: /flow onboarding (conversational, Stitch components) (`/flow/onboarding`)

One client component (`OnboardingFlow`) drives an 8-step script (welcome + 7) rendered as
a chat transcript — agent bubble, then the step's **section card** with rich controls,
then (on submit) a user-answer bubble — with a simulated "thinking" pause and fade-up
entry animations. A sticky stepper on top and a sticky action bar at the bottom frame the
thread; the bar carries the step's only CTA plus a **live match counter** computed against
the 5 mock listings. UI language and components come from the Stitch "Preferencias"
screen (see `.agents/docs/design.md` → "/flow design system"); the mechanic (one step at a
time, agent thinking) is ours. No auth (`/flow` is excluded from `apps/web/proxy.ts`), no
persistence.

## ASCII mockup

State 1 — first load (welcome): stepper reads "Getting started", bar counts with the
default preferences.

```
+------------------------------------------------------------------+
| • GETTING STARTED                              Search parameters |
| [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] |
+------------------------------------------------------------------+
| (Bot)  Chezy AI  Personal agent                                   |
|   •    +--------------------------------------------------------+ |
|        | Hi! To filter with precision across thousands of       | |
|        | listings and agencies, let's define your must-haves.   | |
|        | [Estimated time: 1 min] · 24/7 search active           | |
|        +--------------------------------------------------------+ |
|                                                                    |
|                                 (thread grows here)                |
+------------------------------------------------------------------+
| • 2 listings match right now                          96% match  |
| [                      Let's go  →                              ] |
+------------------------------------------------------------------+
```

State 2 — a step in progress (step 1 shown), after the thinking pause:

```
| • STEP 1 OF 7                                     Routine & area |
| [█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] |
|                                                                    |
|                                                     +-----------+ |
|                                                     | Let's go  | |  <- user bubble
|                                                     +-----------+ |
| (Bot)  Chezy AI  Personal agent                                   |
|        | Where do you spend your days, and how far are you      | |
|        | willing to commute?                                    | |
|                                                                    |
| +--------------------------------------------------------------+ |
| | (➤) 1. Routine & area                        [ High priority ] | |  <- FlowSectionCard
| |  Work or study address you commute to                        | |
| |  [ (case) Diagonal 405 (Passeig de Gràcia), BCN            ] | |  <- FlowTextField
| |  Max commute time                        Max 25 min by metro | |
| |  [  15 min  ] [■ 25 min ■] [  40 min  ]                      | |  <- FlowSegmentedSelector
| |  Target neighborhoods                                        | |
| |  (■Eixample✓)(■Gràcia✓)( Poblenou )( Sant Antoni )( Poble Sec)| |  <- FlowToggleChipGroup
| |  ( Sants )( El Born )( Sant Gervasi )                        | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
| • 1 listing matches right now                         96% match  |  <- recomputed on
| [                      Continue  →                              ] |     every change
+------------------------------------------------------------------+
```

^ CTA is disabled (40% opacity) until the step is complete — for step 1: address typed,
a commute picked, ≥1 neighborhood. Steps 2, 4, 5, 6 have defaults and are always
submittable; step 3 needs "Flexible" or a date.

Step cards (each `FlowSectionCard`, numbered, with the Stitch aside):

```
2. Budget & space          [No hidden fees]  — FlowRangeSlider (€600–€2,000+, thumbs at
                                              €800/€1,200, "Area average: €1,150") +
                                              two FlowStatTile steppers (Bedrooms 1/2/3+,
                                              Min. size +40/+60/80+ m²)
3. When are you moving?                      — FlowDateChips: [Pick a date] [Flexible ±15 days];
                                              "Pick a date" reveals a date TextField
4. Must-haves               [Strict filters] — 6 FlowSelectableTile (Natural light,
                                              Balcony / terrace, Elevator, Air conditioning,
                                              Furnished, Pets allowed)
5. Dealbreakers   (deep)     [Auto-discard]  — description line + 3 FlowCheckboxRow,
                                              all on by default
6. Agent autonomy           [Key decision]   — radiogroup of 3 rows (Just notify me /
                                              Contact, I'll decide / Autopilot) with
                                              description + check disc
7. Review                                    — <dl> summary (Work address, Commute,
                                              Neighborhoods, Monthly range, Space,
                                              Move-in, Must-haves, Dealbreakers "3 of 3 on",
                                              Agent autonomy) + alerts card
                                              (BellRing · "Real-time alerts" · [Active] ·
                                              FlowSwitch on) → CTA "Start searching"
```

## Behavior

- Script: `apps/web/lib/flow/onboarding-steps.ts` — `onboardingSteps` (id, agent line,
  `sectionTitle` for the stepper, `cta` for the bar), plus all option lists
  (`commuteOptions`, `BUDGET`, `roomOptions`, `sizeOptions`, `mustHaveOptions` with a
  `tag` mapping to `ListingTag`, `dealBreakerOptions`, `autonomyOptions`).
- State (`OnboardingFlow`): `stepIndex`, `history` (`{agentMessage, userAnswer}`),
  `preferences: UserPreferences` (single source of truth — steps are **controlled**:
  `prefs` + `onChange(patch)`, no local draft), `isThinking`.
- **Submit lives in the sticky bar**, not in the step: `submitStep()` pushes a history
  entry whose `userAnswer` is `answerSummary(stepId, prefs)` (e.g. "Gràcia, Eixample · max
  25 min from Diagonal 405"), advances, and calls `think()`. On `summary` it
  `router.push("/flow/explore")`. `canSubmit(stepId, prefs)` gates the button.
- **Live counter**: `countMatches(preferences, mockListings)` from
  `apps/web/lib/flow/matching.ts`, evaluated on every render (derived state). Rules: zones
  ∋ neighborhood (if any picked) · `transitMinutesToWork ≤ commuteMaxMin` · price within
  `[budgetMin, budgetMax]` · `rooms ≥` and `sizeM2 ≥` · every must-have's tag present
  (Air conditioning has no tag → ignored) · dealbreakers: `no-dark-interior` requires
  `Exterior-facing`, `no-excessive-deposit` requires `depositMonths ≤ 2`,
  `no-unknown-flatmates` requires `!sharedFlat`. `bestScore` = max `matchScore` among
  matches (0 → bar shows "—"). Unit-tested in `matching.test.ts`.
- Thinking pause, fade-up animations, module-level `scrollIntoViewOnMount` ref callback,
  and `useMountEffect` (from `@chezy/ui`) are unchanged from the previous version.
- Defaults (`initialPreferences`): budget 800–1,200, 2 bedrooms, +60 m², all 3
  dealbreakers on, alerts on, autonomy `cowork`; address/commute/zones/moveIn empty.

## Responsive

- Column `max-w-xl`, `min-h-screen flex-col`; the thread is `flex-1` so the action bar
  sits at the viewport bottom even on short threads.
- Stepper and bar are `sticky` with `bg-paper/90` / `bg-snow/90` + `backdrop-blur-md`;
  the bar pads for `env(safe-area-inset-bottom)`.
- Stat tiles and must-have tiles: 1 column below `sm:`, 2 columns from `sm:`.
- Verified at 375×812 and 1280×900.

## Notes

- Components: `apps/web/components/flow/onboarding/{OnboardingFlow,OnboardingSteps,
  ChatBubble,ThinkingBubble}.tsx`; primitives in `apps/web/components/flow/ui/` (see the
  catalog in `design.md`). `ChipMultiSelect` was replaced by `ToggleChip`.
- What was deliberately **not** carried over from the Stitch export: Tailwind v3 CDN
  runtime, Material Symbols font, the decorative (non-interactive) range bar, the random
  match counter, the hardcoded "Paso 1 de 2" stepper, a Google-hosted image, and the
  `secondary` color names (see `.agents/plans/2026-09-19-port-to-main.md` addendum and the
  approved plan in `~/.claude/plans/dime-si-puedes-leer-floating-boot.md`).
- Preferences still aren't persisted beyond this screen; `/flow/explore` keeps its static
  scoring. The counter is the first place the answers drive matching.
- The pre-existing "1 issue" dev badge is next-auth's missing `AUTH_SECRET`, app-wide.

## User flow checkpoints

```
/flow/onboarding -> thinking -> welcome (+meta pills) -> [Let's go]
  -> thinking -> 1 Routine & area (address, commute, chips) -> [Continue]
  -> thinking -> 2 Budget & space (range slider, bedrooms, min m²) -> [Continue]
  -> thinking -> 3 When are you moving? (date | flexible) -> [Continue]
  -> thinking -> 4 Must-haves (tiles) -> [Continue]
  -> thinking -> 5 Dealbreakers (checkbox rows) -> [Continue]
  -> thinking -> 6 Agent autonomy (radio rows) -> [Confirm autonomy level]
  -> thinking -> 7 Review (dl + alerts switch) -> [Start searching]
  -> router.push("/flow/explore")
  (counter in the bar recomputes on every change; 0 matches never blocks the CTA)
```
