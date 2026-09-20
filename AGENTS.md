# Chezy — Agent Instructions

Chat-centric AI webapp, 0→1 hackathon build. Chatbot UI lives in `apps/web` — it
diverged from the `vercel/chatbot` import (PR #2 is the last sync point; see git
history). NextAuth 5 guest auth is present and required; zod and `useEffect` remain in
upstream-derived template sources under a scoped oxlint override. Neon is swapped for
`pg0` and `@ai-sdk/gateway` for
`@ai-sdk/openai-compatible` (Nebius AI Studio). Idealista scraping pipeline lives in
`apps/scraper` (uv-managed Python CLI). Shared TS/UI primitives live in `packages/*`.

## Layout

Per-package rules live in each package's own `AGENTS.md` — this file is the
repo-wide orientation, not a dump.

- `apps/web/` — `vercel/chatbot`-derived app, diverged (Next.js 16 + React 19).
  See [`apps/web/AGENTS.md`](apps/web/AGENTS.md).
- `apps/scraper/` — uv-managed Python CLI for idealista.com scraping.
  See [`apps/scraper/AGENTS.md`](apps/scraper/AGENTS.md).
- `packages/ui/` — shadcn/ui primitives, hooks, `useMountEffect` escape hatch.
  See [`packages/ui/AGENTS.md`](packages/ui/AGENTS.md).
- `packages/config/` — Valibot env parser (the `process.env` seam for chezy code).
  See [`packages/config/AGENTS.md`](packages/config/AGENTS.md).
- `packages/db/` — Drizzle schema + migrations over pg0.
  See [`packages/db/AGENTS.md`](packages/db/AGENTS.md).
- `packages/contract/` — Valibot schemas shared between apps and packages.
  See [`packages/contract/AGENTS.md`](packages/contract/AGENTS.md).
- `packages/observability/` — LogTape logger + JSONL audit facade.
  See [`packages/observability/AGENTS.md`](packages/observability/AGENTS.md).

## Enforced

Every line in this section is enforced by a `mise.toml` task or a repo-relative file path.
Any change to one of these requires updating the corresponding gate marker.

- `mise.toml` pins the entire toolchain (`node`, `pnpm`, `python`, `uv`, `pg0`). A repo with
  `mise.toml` that runs `mise trust` reproduces the env bit-for-bit. [gate: mise.toml]
- `lefthook.yml` pre-push runs `mise run validate` over every commit being pushed — never use
  `git push --no-verify` to bypass. The gate validates the push, not your diff. [gate:
  lefthook.yml]
- `mise run validate` is the fast merge gate (TS typecheck + lint + format + pyright + ruff +
  format + testmon). It runs via the lefthook pre-push hook and as the `.github/workflows/`
  CI suite on every push. [gate: validate, .github/workflows/]
- `.github/workflows/betterleaks.yml` runs [betterleaks](https://github.com/betterleaks/betterleaks)
  (gitleaks' successor, same default ruleset + TOML schema) on push to `main`, on PRs, weekly
  on Monday 06:00 UTC, and on manual dispatch. Permissions are `contents:read` +
  `security-events:write` only. SARIF is uploaded to Code Scanning on push/schedule and the
  full report is uploaded as a workflow artifact (`betterleaks-report`) with 14-day retention.
  Config: `.betterleaks.toml` extends the default rule pack and allowlists `apps/web/vendor/`,
  `apps/web/tests/`, the two `.env.example` files, `chezy-mock-data/`, `.agents/`, and `docs/`.
  Never commit `betterleaks-report.sarif`. [gate: .betterleaks.toml, .github/workflows/betterleaks.yml]
- `mise run validate:quick` is the in-loop fast tier (~10s, no tests). Use during iteration.
  [gate: validate:quick]
- `pnpm install` uses the global content-addressable store at `~/Library/pnpm/store`. Do not
  override `packageImportMethod` to `hardlink` — APFS hardlinks CoW-materialize across
  worktrees and silently poison the store. Default `auto` prefers `clonefile` on macOS, which
  is safe. [gate: .gitignore]
- `uv` resolves all Python deps through the global cache at `~/.cache/uv` and uses
  `UV_LINK_MODE=symlink` (set in `mise.toml` `[env]`) to symlink `.venv` entries into the
  cache. Hardlink mode silently inflates disk on `mv` / tar. **The venv is project-local per
  worktree** — sharing `.venv` across worktrees poisons editable-install `.pth` files.
  [gate: pyproject.toml]
- `apps/web` diverged from the `vercel/chatbot` import. The template's `app/(auth)/*`
  route group is **present and required** — NextAuth 5 with a `guest` credentials
  provider; `/api/chat` returns `unauthorized:chat` without the guest session cookie and
  `/` redirects to `/api/auth/guest` once. [gate: apps/web/AGENTS.md]
- Zod is **banned** in `packages/*` and `scripts/` (`apps/web` template sources are
  exempt via a scoped `.oxlintrc.json` override). Use Valibot (`valibot` package) for all
  runtime validation, env parsing, and schema-typed inference. Enforced by oxlint
  `no-restricted-imports`. Formisch is the recommended companion for form bindings.
  [gate: .oxlintrc.json]
- Biome is **banned** in chezy code. `apps/web` ships no `biome.jsonc`. Use oxlint +
  oxfmt. [gate: .oxlintrc.json, .oxfmtrc.json]
- `@/*` (Biome's default) is banned in chezy code; we use `~/*` aliased via
  `tsconfig.base.json` / `apps/web/tsconfig.json` paths. [gate: .oxlintrc.json]
- `useEffect` is banned in chezy code (`apps/web` template sources are exempt via a
  scoped `.oxlintrc.json` override). Use the
  five patterns from `.agents/skills/no-use-effect/SKILL.md` (derived state, event
  handlers, data libraries, `useMountEffect`, `key` prop). Enforced by
  `no-restricted-imports` (`importNames: ["useEffect"]`) in `.oxlintrc.json`. The escape
  hatch is `useMountEffect` from
  `@chezy/ui/hooks/useMountEffect`. [gate: .oxlintrc.json]
- `process.env` reads are banned in chezy code outside `packages/config` and known
  `*.config-bound.ts` files. In `apps/web`, only `NEXT_PUBLIC_*` (build-time inlined)
  and `NODE_ENV` reads are allowed; `lib/env.ts` is the single `process.env` reader and
  the listed config-bound files (`next.config.ts`, `drizzle.config.ts`,
  `playwright.config.ts`, `proxy.ts`, `instrumentation.ts`, `lib/db/*`,
  `lib/constants.ts`, `app/(auth)/auth.config.ts`) are exempt via scoped override.
  Enforced by `no-restricted-properties`. [gate: .oxlintrc.json]
- Drizzle schema lives in `packages/db/src/schema/*`. Components and routes must not
  value-import `packages/db`; reach the server via a `createServerFn` body. Enforced by
  `no-restricted-imports` (client graph ban). [gate: .oxlintrc.json]
- The DB engine is `pg0` (single-binary Postgres 18 + pgvector). The server is started via
  the `mise run db:start` task (`pg0 start --port 5432`), not Docker, not a hosted
  provider. `apps/web` reads `POSTGRES_URL` (see `drizzle.config.ts`, `lib/db/`), default
  `postgresql://postgres:postgres@127.0.0.1:5432/postgres`.
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
- `apps/web` talks to the LLM via `@ai-sdk/openai-compatible` (`lib/ai/providers.ts`,
  `lib/ai/models.ts`); env vars are `OPENAI_COMPATIBLE_BASE_URL`,
  `OPENAI_COMPATIBLE_API_KEY`, `CHEZY_MODEL_ID`, `CHEZY_TITLE_MODEL_ID`, read from
  `.env.local`. The project provider is Nebius AI Studio
  (`https://api.studio.nebius.com/v1`, default `deepseek-ai/DeepSeek-V4.1-Flash`); the
  key is `NEBIUS_API_KEY` (also stored as `OPENAI_COMPATIBLE_API_KEY` in GitHub Actions
  secrets, for the future smart-KPI feature). The code default base URL is a local
  bifrost at `http://localhost:8317/v1` and the code default model is
  `deepseek-ai/DeepSeek-V4.1-Flash`. The repo commits `.env.example` (template only). Never
  commit `.env*` files with real values.
- The Valibot schema for env lives in `apps/web/lib/env.ts`; import via
  `import { env } from "@/lib/env"` (the template's `@/*` alias).
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
  `components/chat/*`, `lib/ai/*`). When in doubt, mirror the upstream layout. The radar demo UI was dropped (PR #6); its spec lives in
  `.agents/docs/screens/radar.md`. Voice viewing flow (SLNG / Vonage, `VIEWING_MODE`,
  `CALENDAR_MODE`) lives in `apps/web/lib/{slng,vonage,calendar}.ts` with `/api/viewing`
  and `/api/calendar` routes.
- Route map (2026-09-20): the product surface is `app/(flow)` — `/` landing →
  `/onboarding` → `/explore` → `/explore/[id]`; the `/chat` and `/chat/[id]` pages are
  dropped (components/chat/** and the API routes under `app/(chat)/api/*` are kept for
  reuse); APIs `/api/chat`, `/api/profile`, `/api/profile/count`, `/api/viewing`,
  `/api/calendar`. Legacy `/flow/*` URLs redirect to the root equivalents.

## Stack reference

- **Frontend**: Next.js 16.2 + React 19 + AI SDK 7 + `@ai-sdk/openai-compatible` (Nebius
  AI Studio) + shadcn/ui (Radix) + Tailwind 4 + Drizzle + Drizzle-Kit + Postgres-js +
  **pg0** (local DB).
- **Forms / validation**: Valibot (+ Formisch if/when forms need it).
- **Scrape**: uv workspace, httpx + parsel + pydantic, idealista.com adapter.
- **Lint/format**: oxlint 1.77 + oxfmt 0.60 + oxlint-tsgolint 7 (type-aware).
- **Toolchain**: mise (node 24, pnpm 12, python 3.12, uv latest, pg0 latest, ffmpeg latest).
- **Hooks**: lefthook v2 (pre-push = validate).
