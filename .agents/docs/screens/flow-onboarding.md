# Screen: onboarding (conversational, Stitch components) (`/onboarding`, formerly `/flow/onboarding`)

One client component (`OnboardingFlow`) drives an 8-step script (welcome + 7) rendered as
a chat transcript — agent bubble, then the step's **section card** with rich controls,
then (on submit) a user-answer bubble — with a simulated "thinking" pause and fade-up
entry animations. A sticky stepper on top and a sticky action bar at the bottom frame the
thread; the bar carries the step's only CTA plus a **live match counter** backed by
`GET /api/profile/count`. UI language and components come from the Stitch "Preferencias"
screen (see `.agents/docs/design.md` → "flow design system"); the mechanic (one step at a
time, agent thinking) is ours. Session-gated like the rest of the app; the summary step
persists via `PUT /api/profile` (SearchProfile) and prefills from an existing profile.

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
  25 min from Diagonal 405"), advances, and calls `think()`. On `summary` it PUTs
  `toSearchProfileInput(preferences)` to `/api/profile`, then `router.push("/explore")`
  (a failed PUT shows an inline error in the bar instead of navigating).
  `canSubmit(stepId, prefs)` gates the button.
- **Live counter**: `GET /api/profile/count?maxPriceEur=&minRooms=&minM2=&neighbourhoods=`,
  debounced 300 ms off `updatePreferences`; the server page passes `initialCount` (from
  `countRentCandidates`) so the bar shows a real number on first render.
- Thinking pause, fade-up animations, module-level `scrollIntoViewOnMount` ref callback,
  and `useMountEffect` (from `@chezy/ui`) are unchanged from the previous version.
- Defaults (`defaultPreferences` in `onboarding-steps.ts`): budget 1,200–2,500, 2
  bedrooms, +50 m², all 3 dealbreakers on, alerts on, autonomy `cowork`;
  address/commute/zones/moveIn empty. An existing `SearchProfile` prefills via
  `fromSearchProfile`.

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
- The pre-existing "1 issue" dev badge is next-auth's missing `AUTH_SECRET`, app-wide.
- The chat thread renders `useAgentActivity()` (`apps/web/lib/flow/agent-activity.ts`) as
  extra agent bubbles, live: a ≥95% match calling from either `/explore`'s `AutoCallBanner`
  or a listing's own `AgentCallGate` pushes "Calling {agency}…" (with the same pulsing-dot
  animation as `ThinkingBubble`), then "Called {agency} — visit booked for …" / "…awaiting
  their confirmation" / "The call to {agency} failed — …". Cross-surface only within the
  same tab (`sessionStorage`); the wizard's own `stepIndex`/`history` are not persisted, so
  navigating back here after finishing still restarts the wizard, but any activity already
  logged this session still replays above it.

## User flow checkpoints

```
/onboarding -> thinking -> welcome (+meta pills) -> [Let's go]
  -> thinking -> 1 Routine & area (address, commute, chips) -> [Continue]
  -> thinking -> 2 Budget & space (range slider, bedrooms, min m²) -> [Continue]
  -> thinking -> 3 When are you moving? (date | flexible) -> [Continue]
  -> thinking -> 4 Must-haves (tiles) -> [Continue]
  -> thinking -> 5 Dealbreakers (checkbox rows) -> [Continue]
  -> thinking -> 6 Agent autonomy (radio rows) -> [Confirm autonomy level]
  -> thinking -> 7 Review (dl + alerts switch) -> [Start searching]
  -> PUT /api/profile -> router.push("/explore")
  (counter in the bar recomputes on every change; 0 matches never blocks the CTA)
```
