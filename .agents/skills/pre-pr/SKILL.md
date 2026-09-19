---
name: pre-pr
description: Run a pre-PR branch audit with an eagle-view summary, parallel correctness/quality/test agents, architecture and product lenses, a simplicity sweep, and P0/P1/P2 findings. Use before opening any PR in chezy, or when the user says "run pre-pr", "audit the branch", "check before PR", or "is this ready to PR".
version: 1.0.0
---

# Pre-PR branch audit (chezy)

Audit the current branch before creating a PR. This is the quality gate: run it before every PR so problems are found while they are still cheap.

Self-contained: this variant does not depend on external rule files. Chezy-specific commands and bans are in the last section.

Base branch: `main`.

## Phase 1: Branch snapshot

Gather in parallel:

```bash
git fetch origin main
git rev-list --count HEAD..origin/main   # Freshness gate, run FIRST
git diff origin/main...HEAD --stat
git log origin/main...HEAD --oneline
git diff origin/main...HEAD --shortstat
```

**Freshness gate:** if the count is greater than 0, STOP and flag before any other phase: "branch is N commits behind origin/main, rebase first, then re-run". Never audit a stale branch: a clean diff against a stale base hides files that recent merges superseded, and any verification runs against code that will not survive the rebase.

**Migration leaf gate:** if the diff adds Drizzle migrations under `packages/db`, confirm each new number is absent on `origin/main` for the same namespace, then run the project's migration check. A collision is a P0; renumber before anything else.

## Phase 2: Eagle-view summary

For each file changed:

```markdown
### File: <path>
- Change type: new / modified / deleted
- Lines: +N / -N
- What changed: 1 to 2 sentences, plain language
- Why it changed: inferred purpose (feature, fix, extraction, cleanup)
- Trade-offs: design choices made, if any
```

Group files by concern, not by directory.

## Phase 3: Parallel audit

**Width follows the tier.** When invoked with a tier argument, use it; by hand, derive it and echo `tier: <wide|compact> because <rule>`. Run **wide** when ANY holds: a multi-file or cross-layer change; the diff touches auth, telephony, calendar OAuth, the SLNG dispatch path, or model-facing prompts; two open branches touch the same files; a production incident.

- **wide:** three read-only agents in parallel (below).
- **compact:** one agent whose prompt merges all three checklists, scoped to the diff. It looks for regressions introduced during implementation, not design flaws.

Any P0 from the compact agent means re-run wide before the verdict. Every agent prompt states: **read-only**. Read, grep, glob and read-only git commands only. Never edit, commit or push.

### Agent 1: Correctness and security

- Functions called that do not exist (grep-verify every new call)
- Missing error handling in async paths
- Unsanitized input, injection, XSS, auth bypass
- Race conditions; edge cases (null, empty collection, off-by-one)
- Broken imports, circular dependencies
- State mutated but never persisted; early returns that skip cleanup

### Agent 2: Quality and technical debt

- Single responsibility, descriptive names, short functions
- Duplication against existing utilities
- Pure logic separated from side effects
- Fail-fast errors, no swallowed errors, meaningful messages
- Overengineering: multiple strategies for one question, indirection without value, a regex where a substring check would do, a factory for an object literal. Estimate the simpler replacement.
- Justification bar: for any new abstraction, name the simpler alternative and the evidence it was tried and found insufficient.
- Canonical utility adoption: does a modified handler hand-roll something a shared utility already does?

### Agent 3: Tests and documentation

Three answers required:

1. Does a handler, webhook or API change have one test through the REAL entry point?
2. When one rule feeds several branches, is the case table parametrized across them?
3. Does a pure helper with open-ended input have a property invariant, or a named reason none exists? "It would re-type the function" is not a reason.

Plus, each a P1 when it applies: save paths asserted after reload, not in memory; expected values are literals, not re-derived with the code's formula; mocks at the boundary only; fixture values pinned; clock reads frozen; tests for every new branch; docs updated if architecture changed; no locally re-implemented production logic in a test.

#### Agent health (do not skip)

- Report a one-line status as each agent returns.
- If one errors, returns empty or malformed, relaunch it once; if it fails again, STOP and name the missing dimension.
- If one is still running after the others return, say so rather than going quiet.

## Phase 3b: Architecture and product lenses

- Silent contract changes: did any function's input or output behaviour change under a "no behaviour change" label?
- Security surface: if validation was simplified, does the simpler version miss cases? Assess realistic probability.
- Undocumented behavioural change: if a "moved" implementation changed at all, it belongs in the PR body.
- Security-critical paths need dedicated tests, not indirect coverage.
- User-facing behaviour and rollback safety: can this be reverted cleanly? Any irreversible change?

Flag findings with `[ARCH]` or `[PRODUCT]`.

## Phase 3c: Simplicity sweep (never skip)

Answer the seven questions against the diff and flag each hit with a file:line. If a question bites and the one-line defense cannot be written into the PR body, change the code.

1. Lifecycle: does this recur, or happen once? A one-off gets a command, not a permanent path.
2. Writer-fix completeness: what about rows already written the old way? Ship the backfill or file it.
3. Upstream ownership: is this shape, filter or validation someone else's to provide?
4. User visibility: can the people affected see it? Errors especially.
5. Internal trust: are you defending against your own data? Prove a new abstraction is needed.
6. Durability shape: sweep or retry? Prefer an idempotent reconciliation over a deeper retry ladder.
7. Minimum first iteration: is this one mechanism or two? Build the one the issue names.

## Phase 4: Synthesis report

```markdown
# Pre-PR audit

## Branch: <branch> -> main
## Files: N changed | +A -D lines | M commits
## Tier: <wide|compact> because <rule>

## Eagle-view summary
[grouped file summaries]

## Verdict: READY / NEEDS FIXES / NEEDS DISCUSSION

## P0, must fix before PR
- [issue with file:line and a concrete fix]

## P1, should fix
- [issue with file:line]

## P2, non-blocking
- [observation]

## Quality scorecard
| Principle | Status | Notes |
| Single responsibility | OK/WARN/FAIL | |
| No duplication | OK/WARN/FAIL | |
| Separation of concerns | OK/WARN/FAIL | |
| Error handling | OK/WARN/FAIL | |
| Testability | OK/WARN/FAIL | |
| Simplicity | OK/WARN/FAIL | |

## Lens flags
### [ARCH] silent behavioural changes
### [ARCH] security surface
### [PRODUCT] user impact
```

## Phase 5: Live verification

Decide from the diff:

- Pure move, no behaviour change: say so, and note the unit tests are the right layer.
- Touches the deploy surface (Next build output, Vercel config, the public SLNG webhook/calendar endpoint): live verification is REQUIRED before merge. Flag as P1 if not done.
- Any behavioural change: run the scripted demo path against the running stack.

## Phase 6: Record the gate pass (optional)

If the project gates PR creation on a fresh audit marker, write it only on a READY verdict. When the branch moves, the marker is stale; that is intentional. Never hand-write a marker to skip the audit.

## Chezy repo reminders

- Verify with `mise run validate:quick` in-loop, then `mise run validate` before push. `lefthook` runs `validate` on pre-push; never `git push --no-verify`.
- `useEffect` is banned; apply `.agents/skills/no-use-effect`.
- Valibot, never Zod. `@/*` alias is banned; use `~/*`.
- Read env through `packages/config`; `process.env` is banned outside config files.
- Branch naming: `{feat|fix|chore}/{ticket}/{slug}`.
- Read `.agents/MEMORY.md`; non-trivial work gets a plan in `.agents/plans/`.

## Rules

- **Be specific:** always file:line. Generic feedback is useless.
- **Be constructive:** every problem gets a concrete fix.
- **Do not be pedantic:** skip what a senior engineer would not raise.
- **Every finding traces to a line in the diff:** no speculative issues.
- **Grep every new function call:** the top source of agent-authored bugs.
- **Always report whether the branch is behind its base.**
