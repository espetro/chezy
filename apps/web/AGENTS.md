<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Diverged template

This directory originates from `vercel/chatbot` (PR #2 was the last sync point; see git
history). It has since diverged from upstream and is linted by the root `.oxlintrc.json`
like any other chezy code, with two permanent scoped exemptions:

- `zod` stays in template sources (`app/(chat)/api/chat/schema.ts`, etc.) via the
  `apps/web/**` `no-restricted-imports` override. New chezy-owned code must use Valibot.
- `useEffect` stays in template sources (~90 sites) via the same override. New chezy-owned
  code must use the five patterns in `../../.agents/skills/no-use-effect/SKILL.md`
  (`useMountEffect` escape hatch from `@chezy/ui/hooks/useMountEffect`).

Everything else applies: `~/*` alias, `process.env` via `lib/env.ts` (config-bound files
excepted), `unicorn/no-null`, etc.

## Demo checkpoints

Feature work in this app maps to one of the four demo checkpoints in
[`docs/checkpoints/`](../../docs/checkpoints/README.md). Read the checkpoint file before
touching its code; it names the entry state, the exit state (definition of done), the
contract with the next checkpoint, the code entry points, and what the recording for
the video must show.

| #   | Checkpoint                                                                | Entry points in this app                                                                               |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | [Onboarding](../../docs/checkpoints/01-onboarding.md)                     | `lib/ai/tools/{identify-user,save-user-profile}.ts`, `lib/user-profile.ts`                             |
| 2   | [Matching](../../docs/checkpoints/02-matching.md)                         | `lib/match.ts`, `lib/feed.ts`, `lib/listings.ts`, `lib/ai/tools/search-listings.ts`, `lib/insights.ts` |
| 3   | [Book a visit](../../docs/checkpoints/03-book-a-visit.md)                 | `lib/viewing.ts`, `lib/slng.ts`, `lib/vonage.ts`, `app/api/viewing/route.ts`                           |
| 4   | [Calendar appointment](../../docs/checkpoints/04-calendar-appointment.md) | `lib/calendar.ts`, `app/api/calendar/route.ts`                                                         |

Do not change a checkpoint's exit state or its contract with the next one without
updating the checkpoint file in the same PR. The chat API routes under `app/(chat)/api/*`,
the tools under `lib/ai/tools/*` and the components under `components/chat/*` are kept
for reuse across checkpoints; the `/chat` page itself was dropped (2026-09-20).
