# Checkpoint 1: Onboarding

**Outcome:** the user says who they are and what they want; chezy stores a profile that
the matcher can score against, and confirms it back.

Owner: (fill in)

## Entry state

A fresh session. No profile for this user. Listings seeded (`mise run db:seed`).

## Exit state (definition of done)

- A `User` row exists for the username (synthetic `<username>@chezy.local` email) with
  `User.profile` filled: `areas` (Barcelona neighbourhoods), `budgetMaxEur`,
  `bedroomsMin`, plus `mustHaves` and `redLines` when given, `onboardedAt` set.
- `missingProfileFields(profile)` returns `[]`.
- The agent confirms the captured profile in one or two lines.
- Re-identifying with the same username in a new session returns the same profile
  (PRD goal 4, "identity persists").

## Contract with checkpoint 2

The only handoff is `User.profile` (`UserProfile` in `packages/contract/src/user.ts`).
Field names are the scorer's vocabulary; do not invent synonyms:

- `areas`: strings matched by substring against listing `neighbourhood` / `district`
  ("Eixample", "Poblenou", "Gràcia").
- `mustHaves`: `elevator`, `balcony_or_terrace`, `exterior`, `air_conditioning`,
  `furnished`, `pets_allowed`, `heating`.
- `redLines`: `no_interior` (the only one the scorer can compute today).

## Where the code lives

- Tools: `apps/web/lib/ai/tools/identify-user.ts`, `save-user-profile.ts`.
- Profile helpers: `apps/web/lib/user-profile.ts` (`missingProfileFields`,
  `mergeUserProfile`, `normalizeUsername`).
- Queries: `apps/web/lib/db/queries.ts` (`getUserByUsername`, `createNamedUser`,
  `updateUserProfile`).
- Prompt: `onboardingPrompt` in `apps/web/lib/ai/prompts.ts`.
- Coverage guard: `COVERAGE_CITY` in `apps/web/lib/constants.ts` (Barcelona only).
- Matching store: `SearchProfile` is the profile the scorer reads;
  `saveUserProfile` writes through via `syncSearchProfile`
  (`apps/web/lib/user-profile-sync.ts`) once the profile is complete.
- Frozen alternative: the form wizard at `/onboarding` (`components/flow/onboarding/*`)
  writes a `SearchProfile` row via `PUT /api/profile`, a different store. Reuse its
  step components if you build a form; do not add a second profile store.

## Mock / real

No external dependency except the LLM (`OPENAI_COMPATIBLE_*` in `.env.local`).

## Verification

- `pnpm exec vitest run lib/user-profile.test.ts` (unit).
- Turn 1 and 2 of `mise run eval:trace` (PR #47) assert `identifyUser` then
  `saveUserProfile` before any search.

## Recording (video id `brief`)

- Target about 18 s. Must show: the identity line, the three profile fields being
  captured, the confirmation.
- Use the demo persona from 02-matching.md so the clip chains into checkpoint 2.
- Start: empty screen, composer or first form step focused. End: confirmation visible.

## Open

- Form rendered inside the conversation vs plain questions: undecided after the chat
  UI drop. Whatever the surface, the exit state above is the contract.
