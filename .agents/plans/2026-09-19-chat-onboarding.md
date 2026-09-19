# Plan: in-chat onboarding (2026-09-19)

> Status: approved by user, implementation delegated to subagents.

## Goal

The chat agent must resolve a persistent user identity before any property
search. When the user names themselves ("I'm user X", "I'm X", "my name is X"),
the agent calls a tool that find-or-creates a `User` row keyed by `username` and
returns the stored profile. If required profile fields are missing, the agent
runs onboarding: a mix of pre-defined questions (areas, budget, bedrooms) plus a
free-form invite ("gym nearby", "20 min from work"). Answers are persisted
incrementally to `User.profile` (jsonb).

No real auth yet — username is the creds mechanism, single-user mode. Guest
NextAuth sessions stay as-is (chat ownership only); the username-keyed row is
the durable identity that survives across browsers/sessions.

## Decisions (locked with user)

| Decision | Choice |
| --- | --- |
| Profile storage | `profile` jsonb column on `User` (not a separate table) |
| Identity model | Username-keyed `User` row, find-or-create; session guest row untouched |
| Required fields | `areas` + `budgetMaxEur` + `bedroomsMin` |
| Gate scope | Search/recommendations only; all other chat unaffected |

## Data model

`apps/web/lib/db/schema.ts` — extend `user` table:

- `username`: `varchar("username", { length: 64 })`, unique, nullable.
- `profile`: `json("profile")`, nullable, holds `UserProfile`.

One drizzle migration (`pnpm --filter @chezy/web db:generate`), committed
atomically with the schema change (per `packages/db/AGENTS.md`: schema + SQL in
one commit).

Username-keyed rows get a synthetic `email` (`<username>@chezy.local`) to
satisfy the existing notNull column — `email` varchar(64), so clamp normalized
usernames to ~48 chars. Normalization: lowercase, trim, whitespace → `-`, strip
outside `[a-z0-9._-]`.

## Contract (`packages/contract/src/user.ts`)

Valibot, per package AGENTS (schema only — no business logic here):

```ts
export const userProfileSchema = v.object({
  areas: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
  budgetMinEur: v.optional(v.number()),
  budgetMaxEur: v.optional(v.number()),
  bedroomsMin: v.optional(v.number()),
  workLocation: v.optional(v.string()),
  freeformRequirements: v.optional(v.array(v.string())),
  onboardedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});
export type UserProfile = v.InferOutput<typeof userProfileSchema>;

export const userProfilePatchSchema = userProfileSchema; // all fields optional
export const identifyUserInputSchema = v.object({
  username: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
});
export const saveUserProfileInputSchema = v.object({
  username: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  patch: userProfilePatchSchema,
});
```

Re-export from `src/index.ts`.

## App-side helpers (`apps/web/lib/user-profile.ts`)

Business rules live in the app, not the contract package:

- `normalizeUsername(raw)` → canonical key.
- `missingProfileFields(profile)` → `["areas", "budgetMaxEur", "bedroomsMin"]`
  filtered to what's absent. Required = non-empty areas, budgetMaxEur set,
  bedroomsMin set.
- `mergeUserProfile(base, patch)` → scalars overwrite when present;
  `freeformRequirements` appends + dedupes; never deletes existing keys.

## Queries (`apps/web/lib/db/queries.ts`)

- `getUserByUsername(username)` → `User | null`.
- `createNamedUser(username)` → insert `{ username, email: "<u>@chezy.local",
  isAnonymous: false }`, return row.
- `updateUserProfile(userId, profile)` → set `profile` jsonb + `updatedAt`.

Follow existing style: try/catch → `ChatbotError("bad_request:database")`.

## Tools (`apps/web/lib/ai/tools/`)

Two new tools, registered in `app/(chat)/api/chat/route.ts` (`tools` map +
`activeTools`) and `ChatTools` in `lib/types.ts`:

- `identify-user.ts` → `identifyUser({ username })`: normalize →
  `getUserByUsername` → `createNamedUser` if absent → return
  `{ userId, username, profile, missingFields, isNewUser }`.
- `save-user-profile.ts` → `saveUserProfile({ username, patch })`: resolve user
  (create if needed), `mergeUserProfile`, set `onboardedAt` server-side when
  `missingProfileFields` empties, `updateUserProfile` → return
  `{ userId, profile, missingFields }`. The model never sets `onboardedAt`
  itself.

Input schemas: Valibot from `@chezy/contract` (AI SDK 7 `tool()` accepts
Standard Schema). If inference fights us, fall back to zod — `apps/web` is
exempt anyway — but try Valibot first.

No custom UI: `message.tsx` renders `null` for unknown `tool-*` parts; the
agent narrates onboarding in text. (Optional polish later: generic ToolHeader
fallback.)

## Prompt (`apps/web/lib/ai/prompts.ts`)

New `onboardingPrompt` section appended in `systemPrompt` when `supportsTools`:

- **Identity**: when the user names themselves, call `identifyUser` before
  anything else. Re-identify if they claim a different name mid-chat.
- **Onboarding**: ask missing fields conversationally, 1–2 at a time (never a
  form dump): areas → budget (EUR) → bedrooms. Then invite free-form
  requirements (commute, gym, pets, elevator…). Call `saveUserProfile` as
  answers arrive — don't batch.
- **Gate**: no property search or listing recommendations until identity is
  resolved and `missingFields` is empty. Non-search chat is always fine. When
  onboarding completes, confirm the profile back in 1–2 lines.
- Also soften `regularPrompt`'s "don't ask clarifying questions" so it doesn't
  fight the onboarding flow (or scope that sentence to non-onboarding).

## Commit plan (atomic, one component each)

1. `docs(agents): plan for in-chat onboarding` — this file.
2. `feat(contract): add user profile schemas` — `src/user.ts` + index re-export
   + tests.
3. `feat(web): add username + profile columns to User` — schema.ts + migration
   SQL.
4. `feat(web): user identity + profile queries and helpers` — queries.ts +
   `lib/user-profile.ts` + tests.
5. `feat(web): identifyUser/saveUserProfile tools + onboarding prompt` — tools,
   prompts.ts, route.ts, types.ts.

## Verification

- `pnpm --filter @chezy/contract test`, `pnpm --filter @chezy/web typecheck`.
- `mise run validate:quick` in-loop; `mise run validate` before push.
- Manual: `mise run dev` → "I'm user test" → onboarding questions → answers →
  profile persisted (check via `db:studio` or psql) → new chat, same username →
  profile restored.

## Out of scope / open items

- Real auth (username claim is unauthenticated on purpose; auth lands later).
- Search tool itself — scraper is a stub; the gate contract is prompt-level now
  and future search tools take `userId`.
- No GitHub Project configured → backlog-policy "refined task" unmet; flagged
  to user.
- Guest session → named-user chat re-ownership: chats stay on guest rows.
