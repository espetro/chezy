<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Verbatim template — manual-review checklist

This directory is a verbatim import of `vercel/chatbot` (PR #2). The repo-root
`.oxlintrc.json` excludes `apps/web/**` via `ignorePatterns`, so the chezy rules do not
apply here yet. Before dropping `apps/web/**` from `ignorePatterns`, migrate:

- `@/*` import alias → `~/*` (tsconfig paths; root `tsconfig.base.json` convention).
- `zod` → `valibot` for all runtime validation (`app/(chat)/api/chat/schema.ts`, etc.).
- Decide whether to keep or remove the NextAuth guest-credentials auth in
  `app/(auth)/` — today `/api/chat` depends on it (`unauthorized:chat` without a
  session), so removal needs a replacement session mechanism.
- Direct `process.env` reads → `lib/env.ts`, which already parses env with Valibot;
  other modules should import `env` from it instead of reading `process.env`.
- `useEffect` → the five patterns in `../../.agents/skills/no-use-effect/SKILL.md`
  (`useMountEffect` escape hatch from `@chezy/ui/hooks/useMountEffect`).
- Then drop `apps/web/**` from `.oxlintrc.json` `ignorePatterns` and fix the fallout.
