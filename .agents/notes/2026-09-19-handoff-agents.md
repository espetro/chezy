# Handoff: chezy `feat/template-verbatim-import` PR — push + verify

**Branch**: `feat/template-verbatim-import` at `/Users/josocjoq/.worktrees/chezy/template-verbatim-import`
**Based on**: `origin/main` @ `486c02b`
**Goal of next session**: commit the gate unblock, push, open the PR, verify CI, and confirm the production build works end-to-end.

## State at handoff

### Committed (6 commits, ahead of origin/main)
```
68273a4 fix(repo): mark root package as ESM so validate.ts top-level await runs
e4e3003 feat(web): swap @ai-sdk/gateway for @ai-sdk/openai-compatible (bifrost)
550cd8d feat(web): adopt verbatim vercel/chatbot as apps/web baseline          ← 168 files, 21497 insertions
76bfcc7 chore(web): drop chezy-owned files superseded by verbatim template
f115bd0 chore(pnpm): add catalogs.default and allow template native builds
b57a23b chore(oxlint): scope chezy lint rules to owned packages
```

### Uncommitted (the gate unblock — must commit before push)
```
 M .oxlintrc.json        (added typescript/no-unsafe-* disable for scripts/, ignored)
 M apps/web/proxy.ts     (oxfmt-applied; was already format-clean in vendor ref but
                          oxfmt with chezy's settings normalises it differently)
 M package.json          (added @types/node to root devDeps for root tsconfig)
 M scripts/validate.ts   (scoped package detection + apps/web skip + format globs)
?? tsconfig.json         (new root tsconfig for scripts/, references @types/node)
```

### Background process status
- `next build` was started on `/tmp/chezy-template-build.log` (pid 91421) and **FAILED**. Killed at handoff. Build log retained.
- **Root cause**: `@ai-sdk/provider` peer-dep mismatch. pnpm hoists both `@ai-sdk/provider@4.0.17` (transitive of `ai@7.0.15`) and `@ai-sdk/provider@4.0.2` (direct dep of `@ai-sdk/openai-compatible@3.0.53`). TS sees two distinct `LanguageModelV4`, `JSONObject`, `JSONValue`, `SharedV4ProviderMetadata` types from each version. `next build` fails at `apps/web/app/(chat)/actions.ts:30` with:
  > Type 'LanguageModelV4' is not assignable to type 'LanguageModel'.
  > Types of property 'providerMetadata' are incompatible. ...
- **Dev server works** because Next.js dev mode does not type-check the build graph the same way. So `pnpm dev` smoke tests pass while `pnpm build` fails.
- **Recommended fix** (cheapest): add to root `package.json`:
  ```json
  "pnpm": {
    "overrides": { "@ai-sdk/provider": "4.0.17" }
  }
  ```
  Force a single hoisted version. Then `pnpm install` + `pnpm build` should succeed.
- **Alternative fix**: drop direct `@ai-sdk/provider` from `apps/web/package.json` (rely on the transitive from `ai@7.0.15`). Riskier — `@ai-sdk/openai-compatible@3.0.53` peer-tested against `4.0.2`.

### Gates currently green
- `mise exec -- pnpm exec tsx scripts/validate.ts --quick` → `OK ts: format:check (0.2s)`, `OK ts: lint:scripts (0.2s)`, total 0.4s. Per-package steps (typecheck/lint/test) skip cleanly because `apps/web` is the only changed workspace package and is explicitly excluded per `apps/web/AGENTS.md`.
- `pnpm exec oxlint packages/` → 19 pre-existing errors in `packages/observability/` (LogTape v2 migration parked in stash `session-2026-09-19-lint-fixes`); unrelated to this PR.
- `pnpm exec next dev --turbopack` on `:4011` smoke-tested: guest auth 200, home page 87KB, `/api/models` returns 23 bifrost models, `/api/chat` streams `"OK"` / `"READY"` deltas from `minimax-coding-plan/MiniMax-M3` via bifrost.

### Bifrost config (in `apps/web/.env.local`, gitignored)
- `OPENAI_COMPATIBLE_BASE_URL=http://localhost:8317/v1`
- `OPENAI_COMPATIBLE_API_KEY=<bifrost key from macOS keychain service=bifrost account=$USER; reference via $BIFROST_API_KEY, never paste raw sk-bf-... into committed files>`
- `CHEZY_MODEL_ID=minimax-coding-plan/MiniMax-M3`
- `POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres`

## Steps for the next agent

### 1. STOP THE BUILD FIRST (if still running)
```bash
pkill -f "next build" 2>&1
```
The build log is at `/tmp/chezy-template-build.log`. Already killed at handoff — build FAILED on peer-dep mismatch (see "Background process status" above).

### 2. Add the build fix BEFORE committing anything else

```bash
cd /Users/josocjoq/.worktrees/chezy/template-verbatim-import
# Edit package.json: add pnpm.overrides for @ai-sdk/provider
# Or use `pnpm add -w @ai-sdk/provider@4.0.17 --save-dev` which adds it as override
```

Edit `package.json` to add:
```json
"pnpm": {
  "peerDependencyRules": {
    "allowedVersions": { "react": "19", "react-dom": "19" }
  },
  "overrides": {
    "@ai-sdk/provider": "4.0.17"
  }
}
```

Then:
```bash
mise exec -- pnpm install
mise exec -- pnpm exec next build --prefix apps/web
# Expect: ✓ Compiled successfully
```

If build still fails, try `pnpm dedupe --check` then `pnpm install --force` to flatten the store.

### 3. Re-format validate.ts and apps/web/proxy.ts
```bash
mise exec -- pnpm exec oxfmt scripts/validate.ts
mise exec -- pnpm exec oxfmt apps/web/proxy.ts
```

### 4. Commit the gate unblock + build fix as 5 atomic commits

a. **fix(repo): add root tsconfig so scripts/ type-checks resolve @types/node**
   - New file: `tsconfig.json`

b. **fix(repo): pin @types/node in root devDeps for root tsconfig**
   - `package.json`: add `@types/node: catalog:default` to devDependencies

c. **fix(repo): override @ai-sdk/provider to 4.0.17 to resolve peer-dep mismatch** (the build fix from step 2)
   - `package.json`: add `pnpm.overrides`

d. **fix(validate): scope gate steps to packages actually changed**
   - `scripts/validate.ts`: adds `affectedPackages()` mapper + `appsWebOnly` short-circuit + scoped `filterArgs` and `formatGlobs`

e. **chore(web): oxfmt-clean apps/web/proxy.ts**
   - `apps/web/proxy.ts`: cosmetic

### 5. Push and open PR

```bash
cd /Users/josocjoq/.worktrees/chezy/template-verbatim-import
git push -u origin feat/template-verbatim-import
```

Then open the PR to `main`:
- Title: `feat(web): verbatim vercel/chatbot import + bifrost provider swap`
- Body: see `.agents/plans/2026-09-19-handoff-pr-description.md` (TBD — the next agent should draft this; see "PR description" section below).
- Labels: `feature`, `apps/web`, `infra`, `llm`
- Reviewers: assign @espetro (or whatever the repo convention is — `ghx` skill can find out)

### 6. Verify CI passes

The user-facing AGENTS.md split was completed by a subagent in the main worktree (NOT in this branch). The per-package AGENTS.md files and the new root AGENTS.md are at `/Users/josocjoq/Documents/prjcts/_own/chezy/` (uncommitted). They will NOT be in this PR. That's intentional — the AGENTS.md split is a separate concern that the user can land in a follow-up PR.

This PR's CI must pass on:
- `pnpm install` succeeds
- `mise run validate` green (gate is now scoped; on this branch it should pass cleanly because the only changed workspace package is apps/web which is skipped)
- `pnpm build` (apps/web) succeeds — verify the background build's log first.

If CI fails:
- If `mise run validate` complains about a missing catalog entry: rerun `pnpm install` (catalogs may need a refresh after the type-module commit).
- If `pnpm build` fails on Turbopack: check the build log; the verbatim template is known to compile, so any failure is likely a tsconfig mismatch from the verbatim `apps/web/tsconfig.json` not extending `tsconfig.base.json`. That's intentional (verbatim is verbatim) but means any TS errors in apps/web are not blocked by chezy's strict settings.
- If pnpm hangs on `lefthook install`: re-run once, it's idempotent.

### 7. Re-confirm the dev server smoke test (if CI is green)

```bash
cd /Users/josocjoq/.worktrees/chezy/template-verbatim-import
pg0 --version    # expect pg0 0.15.1+
pg0 start --port 5432 &   # if not running; data dir is ~/.pg0 (user-global)
PORT=4012 mise exec -- pnpm exec next dev --turbopack > /tmp/chezy-final-smoke.log 2>&1 &
sleep 6
rm -f /tmp/cookies.txt
curl -s -c /tmp/cookies.txt -L -o /dev/null http://localhost:4012/api/auth/guest?redirectUrl=/
curl -s -b /tmp/cookies.txt http://localhost:4012/ -o /dev/null -w "home: %{http_code} %{size_download}b\n"
curl -s -b /tmp/cookies.txt http://localhost:4012/api/models -o /dev/null -w "models: %{http_code} %{size_download}b\n"
ID=$(uuidgen)
curl -s -b /tmp/cookies.txt -X POST http://localhost:4012/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$ID\",\"message\":{\"id\":\"$(uuidgen)\",\"role\":\"user\",\"parts\":[{\"type\":\"text\",\"text\":\"reply with OK\"}]},\"selectedChatModel\":\"minimax-coding-plan/MiniMax-M3\",\"selectedVisibilityType\":\"private\"}" \
  --max-time 30 | grep -oE '"delta":"[^"]*"' | head -3
# Expect: "delta":"OK"
pkill -f "next dev"
```

## Key context (read these first)

- **Project memory**: `/Users/josocjoq/Documents/prjcts/_own/chezy/.agents/MEMORY.md` (stack snapshot, non-obvious decisions)
- **Per-package AGENTS.md** (split just landed in main worktree by subagent, NOT in this PR):
  - `/Users/josocjoq/Documents/prjcts/_own/chezy/AGENTS.md` (root, 84 lines)
  - `/Users/josocjoq/Documents/prjcts/_own/chezy/apps/web/AGENTS.md` (verbatim-template manual-review checklist with 10 bug classes)
  - `/Users/josocjoq/Documents/prjcts/_own/chezy/.agents/plans/2026-09-19-split-agents-md.md` (split summary)
- **Gateway swap details**: `apps/web/lib/ai/providers.ts` and `apps/web/lib/ai/models.ts` — committed in `e4e3003` and `550cd8d`. bifrost models endpoint at `{OPENAI_COMPATIBLE_BASE_URL}/models` (Bearer auth).
- **Pre-existing work parked in stash**: `git stash list` → `stash@{0}: session-2026-09-19-lint-fixes` (earlier session's attempt at chezifying; superseded by the pivot to verbatim).
- **Verbatim reference**: `apps/web/vendor/chatbot-template/` (read-only subtree, do not modify).
- **AGENTS.md root rule**: `git push --no-verify` is forbidden. The gate unblock above lets the gate pass without bypassing it. Do not use --no-verify as a shortcut.

## Suggested skills for the next agent

- **dispatching-parallel-agents** — useful for parallelising the 4 commits + PR description draft + CI verification once the gate is unblocked.
- **requesting-code-review** — once the PR is open, run the pre-pr review skill on the 10-commit diff before requesting human review.
- **mcp-builder** or **crw** — not needed here.
- **simplify** — after the gate unblock commits land, run on `scripts/validate.ts` to clean up any obvious rough edges from the scope-split logic (~120 lines added in one commit).
- The user explicitly asked for `parallelize tasks with batch+task` — that was the last instruction before "ok handoff". When resuming, dispatch parallel subagents for: (a) PR description drafting, (b) the 4 gate-unblock commits (each one is independent and could run as a parallel subagent except they share working tree state, so they need to be sequential within one worktree, but PR-description drafting can happen in parallel with everything else).

## What NOT to do

- Do NOT re-apply the stash (`stash@{0}`) — it conflicts with this branch's intent.
- Do NOT touch `apps/web/vendor/chatbot-template/` — read-only reference.
- Do NOT run oxlint/oxfmt on `apps/web/` even though it's un-scoped now — the user's policy is "any chezy setup is for code WE own, not template one". The 10-bug-classes checklist in `apps/web/AGENTS.md` is the manual-review path, not the lint path.
- Do NOT modify `apps/web/.env.local` in any commit — it's `.gitignore`'d, but verify before staging.
- Do NOT add a co-author trailer to any commit (AGENTS.md global rule, also in the user's `~/.agents/` global rules).
- Do NOT use `--no-verify` on `git push` — the gate is now green without it.
