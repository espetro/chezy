# packages/ui

Shared React primitives for chezy. Day 0 ships exactly one export:
`useMountEffect` — the sanctioned escape hatch from chezy's `useEffect` ban.

## Exports

| Path | What |
|---|---|
| `@chezy/ui` | The package root; re-exports the public surface. |
| `@chezy/ui/hooks/useMountEffect` | One-shot mount effect (see SKILL.md). |

## Adding a new component

1. Create the component under `src/components/<name>/<Name>.tsx`.
2. Add a Vitest colocated test under `src/components/<name>/<Name>.test.tsx`.
3. Add a Cosmos fixture under `src/components/<name>/__cosmos__/<Name>.fixture.tsx`
   once `apps/web` has `react-cosmos` wired (tier-2 validation policy in
   `../../AGENTS.md`).
4. Re-export from `src/index.ts` and add a path to `package.json` `"exports"`
   if it should be importable as `@chezy/ui/<name>` directly.

## Boundary rules

- No env reads (banned by `.oxlintrc.json`).
- No DB / persistence imports.
- No `useEffect` outside `useMountEffect` (lint-enforced).
