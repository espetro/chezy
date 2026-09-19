# `@chezy/ui` — agent instructions

Scope: shared TS primitives for `apps/web` and any future consumer.
Inherits root [`AGENTS.md`](../../AGENTS.md) rules; this file adds the
package-specific invariants.

## What's in this package

- **shadcn/ui primitives** (`src/ui/*`) — Radix-based, CVA-styled.
  New primitive? Add it here first, not in `apps/web`.
- **Composed components** (`src/components/*`) — domain-aware wrappers
  around primitives (e.g. message bubbles, prompt input chrome).
- **Hooks** (`src/hooks/*`) — `useMountEffect` is the only escape hatch
  for the no-`useEffect` rule (see below).
- **Shared utils** (`src/lib/*`, `src/index.ts`).

`package.json#exports` is the canonical public surface. New primitive
or component = new entry in `exports` (deep imports that aren't in the
exports map will fail consumers).

## Component-first — verify in Cosmos, then import

Every primitive is developed and verified in **React Cosmos** BEFORE
being imported into a screen. The fixture is the contract; the screen is
the consumer.

Workflow when adding or changing a primitive:

1. Create/update the primitive at `src/ui/<name>.tsx` (or modify the
   CVA config — that is the variant source of truth).
2. Add or update the matching fixture at
   `apps/web/cosmos/<Name>.fixture.tsx` (Multi-Fixtures format:
   `export default { Primary: <…/>, ... }`). For CVA-based primitives,
   the variant matrix is auto-derived from `cva(...)` — a new variant
   added to the CVA appears in the fixture without touching the fixture
   file. For non-CVA primitives, write 3-5 meaningful variants by hand
   (base, error/disabled/loading, controlled vs uncontrolled).
3. Run `pnpm --filter @chezy/web dlx react-cosmos dev` and exercise
   every state visually. Verify dark mode via the fixture's
   `options.theme`.
4. Only then import the primitive into the screen that uses it.

**Verified means** in Cosmos you have exercised at least the **base
state** AND every **other state** (each variant, each size,
error/disabled/loading where applicable) BEFORE writing screen code. A
PR that adds a primitive + screen usage in the same commit but no
fixture exercise is a defect — bounce it.

**Don't hand-roll variant matrices.** The CVA config is the variant
source of truth; map over its keys in the fixture, do not copy-paste
`variant="…"` strings. A stale matrix is worse than no matrix — the
Cosmos feedback loop catches the gap on the next run.

## The `useMountEffect` escape hatch

The repo-wide rule is `useEffect` is banned
([`.oxlintrc.json`](../../.oxlintrc.json) `no-restricted-imports`,
[`no-use-effect` skill](../../.agents/skills/no-use-effect/SKILL.md)).
`useMountEffect` is the only sanctioned way to do one-time external
sync on mount:

```ts
import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";

useMountEffect(function bindKeyboardShortcut() {
  const handler = (e: KeyboardEvent) => { /* ... */ };
  window.addEventListener("keydown", handler);
  return function unbindKeyboardShortcut() {
    window.removeEventListener("keydown", handler);
  };
});
```

It wraps `useEffect(..., [])` with an explicit empty dependency array
and a named function expression (the skill explains why named functions
beat anonymous arrows for readability + stack traces). New hooks
following this pattern go in `src/hooks/` next to `useMountEffect.ts`.

## Verification

- `mise run validate:quick` — typecheck + lint + format, no tests.
- `pnpm --filter @chezy/web dlx react-cosmos dev` — visual exercise of
  primitives (dev-only, not in `mise run validate`).
- `pnpm --filter @chezy/ui test` — vitest suite for this package's
  `*.test.ts` files (one smoke test on day 0).

Full toolchain pinning rules (catalog, lefthook pre-push): see root
`AGENTS.md`.