# Split `chezy/AGENTS.md` into root + per-package files

Date: 2026-09-19. Mechanical split — no behavior change. The previous
monolithic `AGENTS.md` (102 lines, 6.8 KB) is replaced by a short root
orientation + seven per-package/per-app files following the pattern in
`~/Documents/prjcts/_own/brioso/AGENTS.md` (which keeps its own root
short and per-package files own their own rules).

## What got created

| File | Lines | Bytes | Purpose |
| --- | --- | --- | --- |
| `AGENTS.md` (root) | 95 | 4118 | Repo orientation: layout, branch/worktree naming, Conventional Commits + no co-author, two-tier verification, session memory, repo-wide conventions, cross-cutting bans with a pointer to per-package detail. |
| `apps/web/AGENTS.md` | 144 | 7749 | Web-specific: structure, stack, dev workflow (`db:start` / `db:generate` / `db:migrate` / `db:push`), bifrost provider wiring, and the **`feat/template-verbatim-import` manual-review checklist** (10 bug classes that hide under the blanket lint/typecheck skip). |
| `apps/scraper/AGENTS.md` | 90 | 4250 | Scraper-specific: stack (httpx + parsel + pydantic + structlog 24.x), install/run, adapter pattern, polite-HTTP rules, fixture offline mode, observability. |
| `packages/ui/AGENTS.md` | 79 | 3791 | UI-specific: what's in the package, component-first Cosmos workflow, `useMountEffect` escape hatch pattern, verification commands. |
| `packages/config/AGENTS.md` | 82 | 3437 | Config-specific: the single `process.env` seam contract, adding new env vars, naming, web-vs-shared split, boot audit. |
| `packages/db/AGENTS.md` | 87 | 4053 | DB-specific: client-graph ban, adding a new table (drizzle workflow), naming conventions, when to migrate vs push, verification. |
| `packages/contract/AGENTS.md` | 73 | 3131 | Contract-specific: why Valibot (Zod is banned), sharing pattern (`v.parse` at every trust boundary), adding a new contract, what's out of scope. |
| `packages/observability/AGENTS.md` | 87 | 3995 | Observability-specific: the sole-touchpoint rule over LogTape / structlog, env knobs, audit action vocabulary, never-log-secrets rule, adding a new entrypoint. |
| `.agents/plans/2026-09-19-split-agents-md.md` | this file | — | Plan note. |

Total: 8 new files, 737 lines. The original monolithic file was 102
lines; the split moves the per-package rules out of root scope so
agents working on a single package see only what they need.

## What got deleted

Nothing. The original `AGENTS.md` was replaced in place (overwritten
with the new short root orientation). The `CLAUDE.md -> AGENTS.md`
symlink still resolves correctly — no other file references were
affected.

## What did NOT change

- No code, configs, `mise.toml`, `.oxlintrc.json`, `.oxfmtrc.json`,
  `lefthook.yml`, `pyproject.toml`, or `package.json` touched.
- No commits made. Changes sit in the working tree of the main
  worktree at `/Users/josocjoq/Documents/prjcts/_own/chezy/`. The
  verbatim-template worktree at
  `/Users/josocjoq/.worktrees/chezy/template-verbatim-import/` is not
  touched.
- The cross-cutting bans (Zod, Biome, `@/*`, `useEffect`,
  `process.env`, client-graph DB import) are stated once in the root
  file with a pointer to per-package detail — the package files do
  not re-state them at length. They DO show up in the manual-review
  checklist for the verbatim-template worktree, where each ban is a
  specific search target.

## Pattern followed (brioso)

`/Users/josocjoq/Documents/prjcts/_own/brioso/AGENTS.md` is a 200-line
orientation file with a `## Monorepo layout` section that points to
each per-package `AGENTS.md` for the package-specific invariants
(e.g. `apps/web`, `apps/cli`, `apps/worker`, `packages/ui`,
`packages/db`, `packages/jobs`, `packages/obs-js`, `packages/obs-py`).
The per-package files open with `Scope:` and `Inherits the root
AGENTS.md rules` so the inheritance is explicit. The chezy split
mirrors this layout.