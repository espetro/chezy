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
