# 2026-09-19 — apps/web un-ignore (chore/web-unignore-vendor)

- oxlint overrides are LAST-MATCH-WINS by declaration order (opposite intuition from
  ESLint's "most specific wins regardless of order"). Broad `apps/web/**` override must
  be declared before the narrow config-bound exemption. Verified with a scratch repo.
- `no-restricted-properties` supports `{ object: "process.env", allowProperties: [...] }`
  (no `property` key) to allowlist NEXT_PUBLIC_BASE_PATH/NODE_ENV while banning the rest.
  Undocumented in oxlint docs; verified empirically.
- Turbopack build fails when a compat re-export is declared BEFORE its import in the
  same file ("Export 'x' is not defined"). sidebar-history.tsx hit this after the
  no-cycle refactor.
- The `next build` failure over `import.meta.dirname` in lib/vision + lib/insights was
  already fixed on main (474414d) while this branch was in flight; cherry-picked.
- `git add -A` in a worktree where `uv sync` has run picks up an untracked uv.lock.
  Main does not track one; validate.py then fails on a hatchling build error. Swept
  into 2485b8d by accident, dropped in d9e4e85.
- `pnpm exec oxlint` runs from whatever cwd bash lands in — verify with `pwd` when
  using the tool's workdir parameter; it silently ignored a leading `~` cd twice.
