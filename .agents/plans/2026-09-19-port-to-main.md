# Plan: port the standalone `apps/web` prototype onto `main` (2026-09-19)

> Status: **implemented** (2026-09-19), answering the decisions below as: (1) standalone
> routes, explicitly namespaced under `/flow` rather than top-level, so this doesn't
> collide with any in-flight teammate work on `main`'s real routes; (2) design tokens
> ported but fully isolated (new token names only, nothing shared with the app's shadcn
> tokens); (3) English kept, superseding the radar demo's Spanish-locale note for this
> surface specifically; (4) new screen docs added to `screens/README.md` alongside
> `radar.md`, not merged into it. See `.agents/docs/screens/flow-{landing,onboarding,
> explore,match}.md` for the shipped screens' specs, and "What changed during the port"
> below for the concrete deltas from the original prototype. The old prototype checkout
> (`/Users/anabelfrieros/Documents/chezMoi/chezy`) — **including its uncommitted working
> tree, not just its git history** — was the source for this port; it has no commits of
> its own capturing this session's work, so "port from main's git log" would have missed
> almost everything.

## Why this plan exists

A parallel prototype was built at `/Users/anabelfrieros/Documents/chezMoi/chezy`
(uncommitted, standalone `apps/web`, day-0-skeleton base) implementing onboarding,
explore, and match-detail screens for the rental-agent product. Independently, `main`
here progressed 41 commits past that same day-0 skeleton: verbatim `vercel/chatbot`
baseline (auth kept, not stripped), real `packages/{ui,db,config,contract,
observability}`, a real voice-agent viewing/booking call flow (`/api/viewing`,
`/api/calendar`, SLNG/Vonage), and its own now-dropped "concierge/radar" demo (spec kept
at `.agents/docs/screens/radar.md`). The two are not mergeable by `git merge`/`rebase` —
different `apps/web` almost entirely. This plan is the read before deciding what, if
anything, gets rebuilt here.

## Reality check: what actually diverged

| | Old prototype (`chezMoi/chezy`) | `main` (this repo) |
|---|---|---|
| `apps/web` origin | Hand-built, ~20 files, no vendor import | Verbatim `vercel/chatbot` (`apps/web/vendor/chatbot-template/`, squashed subtree) |
| Auth | N/A (never built) | Kept — `app/(auth)/*`, `next-auth` — **contradicts `AGENTS.md`'s own "auth stripped" line**, which is stale relative to code |
| Zod | Not installed | `zod@^4.4.3` **and** `valibot` both present in `apps/web/package.json` — the "Zod is banned" gate apparently doesn't reach vendored/template code |
| Design tokens | Custom "Chezy style reference": obsidian/graphite/ember palette, DM Sans, 36px card radius, hairline borders (`.agents/docs/design.md`, rewritten 2026-09-19) | Still the original day-0 shadcn-neutral placeholder (`--background`/`--primary`/blue accent) — **`main`'s own `design.md` was never updated**, it predates both prototypes |
| `packages/*` | Don't exist; everything colocated in `apps/web/lib` | Real: `ui`, `config`, `db`, `contract`, `observability` |
| `useMountEffect` | Ad-hoc local copy at `apps/web/lib/hooks/useMountEffect.ts` (noted as temporary in its own comment) | **Confirmed**: canonical at `packages/ui/src/hooks/useMountEffect.ts`, exported from `packages/ui/src/index.ts` as `useMountEffect` — import `{ useMountEffect } from "@chezy/ui"` when porting, delete the local copy |
| Product surface | 4 standalone routes (`/`, `/onboarding`, `/explorar`, `/explorar/[id]`), no chat | `app/(chat)/*` — the actual chat product; onboarding/explore/match don't exist here at all |
| Agent execution | UI-only shells, no real send/call (`AgentContactGate` never calls an API) | Real call dispatch exists (SLNG/Vonage) for the viewing flow, dropped UI kept as spec |
| `.agents/MEMORY.md` / `AGENTS.md` in `main` | — | Both **stale**, describing the day-0 state, not the 41 commits of actual work. Don't trust them as ground truth; read code. |

The takeaway: this isn't "two branches of the same app," it's two different apps that
happened to share a day-0 ancestor. Porting means **reimplementing against `main`'s real
stack, guided by the old prototype's validated UX/copy** — not cherry-picking commits or
copy-pasting components (they'd drag in the wrong Tailwind/shadcn token names, the wrong
`useMountEffect` import path, and duplicate what `main`'s real viewing flow already does).

## Decisions needed (in order — each blocks the next)

### 1. Where does onboarding/explore/match live in `main`'s product?

`main`'s own `screens/radar.md` already answers this for its own demo: *"The demo predates
the verbatim `vercel/chatbot` import. If concierge is rebuilt inside the chatbot, the
scripted transcript becomes a real conversation and 'View on Radar' becomes a
tool-invocation card — the chatbot's message surface is the natural host."* The same logic
applies to onboarding: a 10-step scripted Q&A is arguably *exactly* what the chat surface
is for. Two real options, not a false binary:

- **(a) Host onboarding inside `app/(chat)/*`** as the first conversation, using real AI
  SDK 7 messages instead of a hardcoded `onboardingSteps` array. Loses the current
  hand-tuned thinking-delay/animation timing (would need to match streaming-token pacing
  instead), gains an actually-intelligent agent instead of a script.
- **(b) Keep onboarding/explore/match as standalone routes**, same shape as the prototype,
  and treat the chat as a separate "talk to your agent anytime" surface. Cheaper to port
  (the ASCII specs translate near-1:1), but produces two disconnected product surfaces.

Not this plan's call — needs a product decision before any component is ported.

### 2. Design tokens: which system wins?

Neither of `main`'s two token systems (day-0 shadcn-neutral in `design.md`, or the
radar demo's abandoned inline dark palette) is what shipped in the prototype. The
prototype's obsidian/ember/DM-Sans system is more finished and was validated visually
(screenshotted, walked through interactively) — recommend porting the **token layer**
(`apps/web/app/globals.css`'s `@theme` block + `.agents/docs/design.md`) regardless of
what happens with the screens themselves, since `main`'s current tokens are an
unstyled placeholder nobody chose deliberately.

### 3. Product naming and language

The prototype went through two renames this session: "Casilla" → "chezMoi" (product
brand), and Spanish → English (all UI copy, onboarding script, mock data, and the 4
agent system prompts in `.agents/docs/agent-system/prompts.md`). `main`'s existing
surfaces (the real chat, the dropped radar demo) are Spanish-flavored on purpose per
`screens/radar.md`'s own note ("Keep the locale when rebuilding — it sells the use
case."). **These two decisions conflict** — confirm with the user whether the
English-language decision applies repo-wide (superseding the radar note) or only to the
new onboarding/explore/match surfaces, before porting any copy.

### 4. Screens docs: two independent inventories, don't merge the READMEs

`main`'s `.agents/docs/screens/README.md` indexes `radar.md` only. The old prototype
checkout now has its own `screens/README.md` indexing `landing.md`, `onboarding.md`,
`explore.md`, `match.md`. If/when screens are ported here, add them to *this* repo's
`screens/README.md` as new entries — don't overwrite it, and don't copy the old
prototype's README verbatim (it describes files that won't exist at the same paths once
ported, e.g. if Decision 1 picks option (a)).

## Scope if the answers are "(b) standalone routes, port the tokens, keep English"

Complexity: `S` ≤ ~1h, `M` ~2–4h, `L` > 4h.

| Area | Work | Size |
|---|---|---|
| Design tokens | Port `@theme` block from prototype's `globals.css` into `main`'s `apps/web/app/globals.css`; reconcile with shadcn's `--color-*` semantic layer already there (don't just overwrite — `main`'s chat UI depends on `--sidebar`, `--chart-*`, etc. that the prototype never needed) | M |
| `packages/contract` types | Add `UserPreferences`, `Listing`, `MatchReason`, `NeighborhoodProfile`, `AgentDraftMessage` (from prototype `lib/types.ts`) as Valibot schemas, not bare TS interfaces — `main` already banned Zod interfaces in favor of Valibot-typed inference elsewhere | S |
| Onboarding route | Rebuild `OnboardingFlow`/`OnboardingSteps`/`ChatBubble`/`ThinkingBubble` in `apps/web/app/onboarding/`, importing `useMountEffect` from `@chezy/ui`, writing the finished `UserPreferences` into `packages/db` instead of discarding it | L |
| Explore + match routes | Rebuild `ExplorarFeed`/`CandidateCard`/`MatchDetail`/`NeighborhoodProfile`, replacing `mockListings` with a real `packages/contract`-typed fetch (even if backed by a fixture at first, per `screens/radar.md`'s own precedent of typed fixtures over raw mock arrays) | M |
| `AgentContactGate` | Port as-is conceptually (approve/edit/discard shape is sound and matches `.agents/docs/agent-system.md` §2's gate contract), but wire "Approve & send" to a real `sendEmail` tool call instead of a local-only status flip | M |
| Agent system spec | `.agents/docs/agent-system.md` + `agent-system/prompts.md` (autonomy tiers, guardrails, 4 system prompts) describe a **different** orchestrator than `main`'s existing viewing/booking flow. Reconcile before implementing either — don't end up with two competing "call the agency" code paths (the spec's `Call agent` prompt vs. `main`'s working SLNG/Vonage dispatch) | M (reconciliation only; implementation not sized here) |

## What NOT to port

- The prototype's mock data verbatim (`lib/mock-listings.ts`) — fine as fixtures during
  the rebuild, but `main` has real `packages/db`/`packages/contract`; don't let 5
  hardcoded listings become load-bearing.
- `lib/hooks/useMountEffect.ts` as a new file — delete it once pointed at `@chezy/ui`.
- Any assumption that onboarding answers flow into scoring — they never did in the
  prototype (documented gap in every screen spec's Notes section); this needs real
  design work, not a port.

## What changed during the port (implemented 2026-09-19)

Concrete deltas from the prototype's code, all forced by landing in a real codebase with
its own conventions rather than a blank `apps/web`:

| Prototype | `main` (`/flow`) | Why |
|---|---|---|
| `~/*` import alias | `@/*` | `main`'s actual `apps/web/tsconfig.json` uses `@/*` (the untouched `vercel/chatbot` default) — `AGENTS.md`'s claim that `~/*` is enforced is stale; the code, not the doc, wins |
| `apps/web/lib/{types,constants,mock-listings,onboarding-steps,agent-draft,ui-classes}.ts` | `apps/web/lib/flow/*.ts` | `main` already has real `lib/types.ts`, `lib/constants.ts` — colliding filenames, and on case-insensitive filesystems `Button.tsx` vs. shadcn's `button.tsx` would collide too |
| `Button`, `Pill`, `Card`, `ScoreBadge`, `AgentMark`, `ChipMultiSelect` (component names) | `FlowButton`, `FlowPill`, `FlowCard`, `FlowScoreBadge`, `FlowAgentMark`, `FlowChipMultiSelect` | Same reasoning as above, applied to the exported names themselves, not just file paths — grepping "Button" in this codebase should not surface two unrelated components |
| Local `cn()` in `lib/cn.ts` | `import { cn } from "@/lib/utils"` | Identical implementation already exists in `main`; no reason to duplicate |
| Local `useMountEffect` in `lib/hooks/` | `import { useMountEffect } from "@chezy/ui/hooks/useMountEffect"` | Confirmed to exist for real at `packages/ui/src/hooks/useMountEffect.ts`; added `@chezy/ui` as a workspace dep of `apps/web/package.json` |
| Semantic Tailwind classes `bg-card`, `text-muted-foreground` (a few spots: `Card`, `CandidateCard`, `ExplorarFeed`→`ExploreFeed`, `AgentContactGate`, `OnboardingSteps`) | `bg-snow`, `text-fog` | `main`'s shadcn tokens already own `--color-card`/`--color-muted-foreground` (oklch neutral, used by the real chat UI) — reusing those class names would have reskinned the whole app, not just `/flow`. `bg-card-subtle` was safe to keep as-is (new token name, no main equivalent) |
| Design tokens declared at `:root`/`@theme` (global) | Same names, still declared globally in `@theme` (obsidian, ember, radii, etc. are all *new* token names — safe), but the two or three that would have collided (above) were renamed at the component level instead of scoped via a wrapper class | Simpler than a `.flow-theme` cascade-scoping trick; equally isolated since the colliding names never got redefined at all |
| Routes at `/`, `/onboarding`, `/explorar`, `/explorar/[id]` | `/flow`, `/flow/onboarding`, `/flow/explore`, `/flow/explore/[id]` | Explicit isolation from `main`'s real routes per this session's request; also anglicized `explorar` → `explore` while touching the route table anyway |
| No auth | Excluded from `apps/web/proxy.ts`'s catch-all auth matcher (early `pathname.startsWith("/flow")` return) | `main`'s `proxy.ts` (Next 16's `middleware.ts` successor) redirects every unauthenticated request to guest auto-login, which needs a working `packages/db` — `/flow` has neither Postgres nor a reason to require a session |
| `next.config.ts` images | Added `images.unsplash.com` to `remotePatterns`, added `@chezy/ui` to `transpilePackages` | `/flow`'s mock photos are Unsplash URLs; `@chezy/ui` ships TS source, needs transpiling like `@chezy/contract` already does |
| DM Sans loaded in the root layout | DM Sans loaded in `apps/web/app/flow/layout.tsx` only | `main`'s root layout loads Geist/Geist Mono for the real app; `/flow` needs its own font scope, applied via a wrapper `<div>` (not `<html>`/`<body>`, which are shared) |

Verified: `tsc --noEmit` on `apps/web` (~9s, clean), all four `/flow` routes loaded and
visually spot-checked in a real browser (landing, onboarding through the first exchange,
explore feed with images, match detail through the full `AgentContactGate` idle state).
Not run: `pnpm build` (its `build` script runs `tsx lib/db/migrate` first, which needs a
live Postgres this environment doesn't have) — build-time correctness of `/flow`
specifically (e.g. `generateStaticParams` for the 5 mock listings) is therefore unverified
here, only dev-mode rendering.

## Addendum (2026-09-19, later): Stitch "Preferencias" UI adopted into `/flow/onboarding`

The onboarding was rebuilt on the Stitch design's components (numbered section cards,
segmented commute selector, dual-thumb budget slider, stat-tile steppers, selectable
tiles, checkbox rows, switch, sticky stepper + action bar with a real live match counter)
while keeping the conversational mechanic. Elevation rule for `/flow` flipped to
`shadow-sm`/no-border (Stitch) — the chat app's rules above this section are untouched.
Full component catalog: `.agents/docs/design.md` → "/flow design system". Screen spec:
`.agents/docs/screens/flow-onboarding.md`. The approved implementation plan (with the
table of what was deliberately not carried over from the Tailwind-v3 export) lives at
`~/.claude/plans/dime-si-puedes-leer-floating-boot.md`.

## Addendum (2026-09-19, later still): email-draft gate replaced by an autonomous call gate

`AgentContactGate` (email draft approve/edit/discard) was removed. `/flow/explore/[id]`
now shows `AgentCallGate`: matches ≥95% (`AUTO_CALL_MATCH_THRESHOLD`,
`lib/flow/constants.ts`) trigger an autonomous "Calling {agency}… → Called · visit booked"
sequence on load, overriding the onboarding autonomy tier by design; matches below 95% get
a manual "Call the agency now" override that runs the same sequence. Fully simulated
(`lib/flow/calling.ts`), not wired to the real `/api/viewing`+`/api/calendar` flow that
already exists in this repo — see `.agents/docs/screens/flow-match.md`'s Notes for why
(the `proxy.ts` auth-matcher constraint). `gracia-01`'s mock `matchScore` was bumped
94→96 so the auto-call path is reachable in the demo.
