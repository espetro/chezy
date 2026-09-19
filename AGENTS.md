# Chezy — Agent Instructions

Chat-centric AI webapp, 0→1 hackathon build. Chatbot UI lives in `apps/web` (a Next.js 16 +
React 19 fork of `vercel/chatbot` with auth stripped, Zod swapped for Valibot, Biome swapped
for oxlint/oxfmt, Neon swapped for `pg0`). Idealista scraping pipeline lives in `apps/scraper`
(uv-managed Python CLI). Shared TS/UI primitives live in `packages/*`.

## Enforced

Every line in this section is enforced by a `mise.toml` task or a repo-relative file path.
Any change to one of these requires updating the corresponding gate marker.

- `mise.toml` pins the entire toolchain (`node`, `pnpm`, `python`, `uv`, `pg0`). A repo with
  `mise.toml` that runs `mise trust` reproduces the env bit-for-bit. [gate: mise.toml]
- `lefthook.yml` pre-push runs `mise run validate` over every commit being pushed — never use
  `git push --no-verify` to bypass. The gate validates the push, not your diff. [gate:
  lefthook.yml]
- `mise run validate` is the fast merge gate (TS typecheck + lint + format + pyright + ruff +
  format + testmon). It runs in CI on every branch push, not just PRs. [gate: validate]
- `mise run validate:quick` is the in-loop fast tier (~10s, no tests). Use during iteration.
  [gate: validate:quick]
- `pnpm install` uses the global content-addressable store at `~/Library/pnpm/store`. Do not
  override `packageImportMethod` to `hardlink` — APFS hardlinks CoW-materialize across
  worktrees and silently poison the store. Default `auto` prefers `clonefile` on macOS, which
  is safe. [gate: .gitignore]
- `uv` resolves all Python deps through the global cache at `~/.cache/uv` and uses
  `UV_LINK_MODE=symlink` (set in `mise.toml` `[env]`) to symlink `.venv` entries into the
  cache. Hardlink mode silently inflates disk on `mv` / tar. **The venv is project-local per
  worktree** — sharing `.venv` across worktrees poisons editable-install `.pth` files (see
  `.agents/docs/worktree-disk-budget.md`). [gate: pyproject.toml]
- `apps/web` is the Next.js 16 + React 19 fork of `vercel/chatbot`. The template's
  `app/(auth)/*` route group is removed entirely (auth is out of scope for the hackathon);
  no `next-auth` package, no `auth.*` route, no `getSession` calls in `middleware.ts`.
  [gate: apps/web/AGENTS.md]
- Zod is **banned** in `apps/web` and `packages/*`. Use Valibot (`valibot` package) for all
  runtime validation, env parsing, and schema-typed inference. Enforced by oxlint
  `no-restricted-imports`. Formisch is the recommended companion for form bindings.
  [gate: .oxlintrc.json]
- Biome is **banned** in `apps/web`. The upstream template ships `biome.jsonc`; we replace
  it with `.oxlintrc.json` + `.oxfmtrc.json`. [gate: .oxlintrc.json, .oxfmtrc.json]
- `@/*` (Biome's default) is banned; we use `~/*` aliased via `tsconfig.base.json` paths.
  [gate: .oxlintrc.json]
- `useEffect` is banned. Use the five patterns from `.agents/skills/no-use-effect/SKILL.md`
  (derived state, event handlers, data libraries, `useMountEffect`, `key` prop). Enforced by
  `no-restricted-syntax` in `.oxlintrc.json`. The escape hatch is `useMountEffect` from
  `@chezy/ui/hooks/useMountEffect`. [gate: .oxlintrc.json]
- `process.env` reads are banned outside `packages/config` and known `*.config-bound.ts`
  files. Inject config through a constructor / ctx. Enforced by `no-restricted-properties`.
  [gate: .oxlintrc.json]
- Drizzle schema lives in `packages/db/src/schema/*`. Components and routes must not
  value-import `packages/db`; reach the server via a `createServerFn` body. Enforced by
  `no-restricted-imports` (client graph ban). [gate: .oxlintrc.json]
- The DB engine is `pg0` (single-binary Postgres 18 + pgvector). The server is started via
  the `mise run db:start` task (`pg0 start --port 5432`), not Docker, not a hosted
  provider. `DATABASE_URL` defaults to `postgresql://postgres:postgres@127.0.0.1:5432/postgres`.
  [gate: mise.toml, .env.example]
- `mise.toml` sets `UV_LINK_MODE = "symlink"` and pyproject sets `link-mode = "symlink"` +
  `compile-bytecode = false`. Do not "fix" these. [gate: mise.toml, pyproject.toml]
- Every commit follows Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`, `perf:`). No `Co-Authored-By` trailers in commit messages (global repo policy).
  [gate: lefthook.yml]

## Conventions

Non-gated, advisory. Lint-clean does not mean idiomatic.

- Branch naming: `{feat|fix|chore}/{ticket}/{short-description}` — e.g.
  `feat/chezy-12-idealista-scraper`. Never a username prefix. Worktrees live in
  `$HOME/.worktrees/{ticket}/{slug}`, never inside the repo.
- Every commit is atomic — one self-contained logical change per commit. A multi-component
  change gets one commit per component.
- Plans go to `.agents/plans/YYYY-MM-DD-<purpose>.md` before non-trivial implementation
  begins. Trivial mechanical changes (typos, refactors, one-line bumps) may skip the plan.
- `apps/web` reads `AI_GATEWAY_API_KEY` and provider-specific keys from `.env.local`. The
  repo commits `.env.example` (template only). Never commit `.env*` files with real values.
- The Valibot schema for env lives in `apps/web/lib/env.ts`; import via
  `import { env } from "~/lib/env"`. Oxlint enforces the single import path.
- Hardcoded constants live in `apps/web/lib/constants.ts`, each with a short comment naming
  what governs the value. Product/ops changes via PR, not a secret.
- `apps/scraper` is a uv workspace member; it owns its own deps and is independently
  runnable as a CLI (`uv run scraper`). API integration (if any) lives in `apps/api` (TBD —
  not scaffolded on day 0 per the user spec).
- Type nullability: internal code uses `T | undefined`. `T | null` is allowed at wire / DB /
  contract seams only, enforced by `unicorn/no-null`. The default oxlint rule is preserved.
- Test conventions: use Vitest (`vitest` catalog pin) for TS; pytest for Python. Test files
  are colocated as `*.test.ts(x)` and `test_*.py`. For the day-0 stub, one trivially-passing
  test per app is enough to prove the gate wires up.
- Read `.agents/MEMORY.md` first on session start. After non-trivial work, append a dated
  `.agents/notes/YYYY-MM-DD.md` entry if anything surprised you.
- `apps/web` follows `vercel/chatbot`'s structure (`app/(chat)/*`, `app/api/chat/route.ts`,
  `components/chat/*`, `lib/ai/*`). When in doubt, mirror the upstream layout; the
  authentication bits are the only thing removed.

## Stack reference

- **Frontend**: Next.js 16.2 + React 19 + AI SDK 7 + `@ai-sdk/gateway` + shadcn/ui (Radix)
  + Tailwind 4 + Drizzle + Drizzle-Kit + Postgres-js + **pg0** (local DB).
- **Forms / validation**: Valibot (+ Formisch if/when forms need it).
- **Scrape**: uv workspace, httpx + parsel + pydantic, idealista.com adapter.
- **Lint/format**: oxlint 1.77 + oxfmt 0.60 + oxlint-tsgolint 7 (type-aware).
- **Toolchain**: mise (node 24, pnpm 12, python 3.12, uv latest, pg0 latest, ffmpeg latest).
- **Hooks**: lefthook v2 (pre-push = validate).
