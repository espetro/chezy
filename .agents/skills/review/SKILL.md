---
name: review
description: Review someone else's pull request for merge readiness. Covers mergeable status, scope versus issue, layer ownership, test coverage, security surface, and follow-ups. Auto-detects depth, so small PRs get one pass while complex ones auto-launch parallel security, correctness, and simplicity agents. Always outputs a review action recommendation plus a ready-to-paste draft under a hard voice contract. Output stays in the conversation and NEVER posts to the forge. Use when the user asks to "review PR X", "check PR X", or "is PR X ready to merge".
version: 1.0.0
---

# PR merge-readiness review

Review PR **$ARGUMENTS** for merge readiness in `espetro/chezy`.

**CRITICAL: do not post anything to the forge. The review lives in the conversation.** This overrides any general instruction to comment on PRs.

## Step 1: Fetch context

```bash
gh pr view <N> --repo <ORG>/<REPO> --json number,title,state,headRefName,baseRefName,mergeable,body,commits,files,reviews,comments,headRefOid
gh pr diff <N> --repo <ORG>/<REPO>
```

Is it mergeable? Any conflicts? Read the full commit messages: they carry the why that the diff does not.

## Step 2: Mode detection

Compute from the diff:

- non-test lines changed (exclude tests, lockfiles, snapshots, generated files)
- sensitive paths touched: auth, telephony, calendar OAuth, the SLNG dispatch path, `packages/config`, model prompts
- multi-repo coordination: counterpart open PRs, or an explicit "depends on #X"
- visual or behavioural surface: UI components, response shape, user-facing flows
- skip indicators: docs only, dependency bump only, pure refactor with no behaviour change per the body

Then pick:

- **Skip:** docs only, dependency bump, typo. Still produce an action and a one-line draft.
- **Standard (default):** straight through the steps below.
- **Deep:** any of non-test lines large, sensitive paths, or a new API contract. Launch in parallel, in one message: a security agent, a correctness agent, and a simplicity agent. Note "deep mode triggered, reason: X".

**Agent health:** report each agent's return. If one errors or comes back empty, relaunch it once; if it fails again, STOP and name the missing dimension. Never present the review as complete with a dimension silently missing.

## Step 3: Review checklist

**Blocking**

- functions called that do not exist on this branch (grep-verify every new call)
- functions from an unmerged PR referenced without branching from it
- unsanitized input, injection, XSS, hardcoded secrets
- broken layer ownership: a fetch layer ranking, a response layer re-fetching
- missing tenant scoping on a query
- code exported from production modules solely for tests
- a response field that can be false for more than one reason with no way to distinguish them
- a non-2xx response with no stable machine-readable error code
- a test file that imports no production code
- a cross-origin message handler with no explicit origin allowlist

**Should fix**

- missing error handling in async paths
- hardcoded values that belong in configuration
- missing validation at a system boundary
- tests missing for new behaviour
- duplication of an existing utility; a handler hand-rolling a shared utility
- a new type declared outside `packages/contract` when it is conceptually shared
- environment variable parsed without a fallback; `process.env` read outside `packages/config`
- `useEffect` used where a derived value or event handler would do
- Zod imported instead of Valibot
- new data access inlined in a request handler instead of the domain's data module

**Non-blocking**

- naming inconsistencies, simplifiable code, minor style
- hardcoded style values where design tokens exist
- a docstring that claims one approach while the code does another

## Step 4: Project compliance

Check against the repo's own conventions: Conventional Commits, no `Co-Authored-By` trailers, no personal names, atomic commits, docs updated if architecture changed, `mise run validate` green.

## Step 5: Dependency check

Does this PR depend on other open PRs? Will merging it break one? Any conflicts with `main`?

## Output format

Produce all sections, in order. Never skip the action or the draft.

```markdown
## PR #N - <title>
**Branch:** head -> base | **Mergeable:** yes/no | **Files:** N | **Lines:** +A -D

### Verdict: READY / NEEDS FIXES / NEEDS DISCUSSION
**Mode:** Standard / Deep / Skip [+ trigger reason]

### Review action
- **Submit as:** Approve / Request changes / Comment
- **Why:** 1 to 2 sentences on why this action and not the other two

### Draft submission (ready to paste)
[see voice contract below]

### Internal analysis (not for the forge)
P0 / P1 / P2 with file:line each

### What this PR does
1 to 3 sentences

### Merge notes
ordering dependencies, post-merge steps, configuration changes needed
```

## Decision rule for the action

- **Approve:** no blockers, remaining notes cosmetic, code correct.
- **Request changes:** a blocker, or several findings that materially reshape the PR.
- **Comment:** findings on a trusted author's PR they will fix quickly, or concerns worth raising without blocking. Lean here for small PRs from trusted authors. Approve after the fix lands.

## Voice contract for the draft

One comment block for all findings. The first draft must be postable as is: if the user has to shorten it, the skill failed.

```markdown
<one warm human line, optional, never praise padding>

<one intro line>
- path:line -> what happens (evidence). optional one-clause suggestion or question.
severity is the ORDER of bullets, never a tag in the comment
```

- about 25 words per bullet, 30 is the ceiling: one fact plus one consequence
- the mechanism stays in the internal analysis: the author owns the codebase
- at most three bullets, usually one; a clean PR gets exactly one line ("lgtm thanks")
- drop every non-blocking note and every defensive should-fix from the posted draft
- path:line from the PR head, re-verified this session
- peer register, casual. Banned: "consider", "I would suggest", "wondering if", "possibly", "as a best practice", any restatement of the PR
- related work by PR number; never another issue's autolinking ID; never a person's name
- no dash punctuation; an arrow is fine

Silent self-check before showing: word-count each bullet; verify every path:line against the head sha; grep for banned phrases, dashes, names, foreign IDs; confirm at most three bullets in severity order.

Show ONE draft. Offer a second variant only when the action is Comment and a plain approve is a reasonable alternative.

## Rules

- **Fact-check every claim against the current branch BEFORE drafting.** A named path, symbol, endpoint, dependency or "missing" pattern is verified, not recalled. False claims to a reviewer erode credibility faster than missed findings.
- **Grep every new function call.**
- **Read the full commit messages.**
- **Be specific:** file:line from the head sha, confirmed to hold what the finding says.
- **Do not be pedantic:** skip what a senior engineer would not raise.
