# Capability forge trigger

A structured rejection can reveal a capability gap when too few listings have
usable evidence for the rejected focus. Chezy records one `capability_job` for
that gap, then (when enabled) starts a Devin session. The session can open a PR,
and the session and PR links are shown in the explore status line and accepted
comparison panel.

The local verifier remains a CLI concern: run `mise run forge:<task>` for the
allowlist and hold-out gates. Those checks are not run in a request.

## Environment

- `FORGE_TRIGGER_MODE=off` never launches a forge job.
- `FORGE_TRIGGER_MODE=mock` records and shows a simulated running job.
- `FORGE_TRIGGER_MODE=devin` starts a real v1 Devin session and requires
  `DEVIN_API_KEY`.

Each capability is globally deduplicated by its capability id, so a later
rejection reuses the existing job instead of opening another session.

## Status

Evidence is the populated `outdoorSpace` column only. The current seed has 0%
coverage in that column, so the gap fires on every `missing_balcony` rejection
until the capability PR lands. Amenity text is deliberately not counted.

## Live run (2026-09-20)

One `missing_balcony` rejection with `FORGE_TRIGGER_MODE=devin` created the
capability job and forge session
<https://app.devin.ai/sessions/b5b15584a3ca40b79e02c2c51fd613e9>, which opened
<https://github.com/espetro/chezy/pull/97> about six minutes later; the job row
moved to `pr_opened` and the panel showed the PR link. The comparison itself ran
in <https://app.devin.ai/sessions/c174a7010a064f9e887b7cb4f6168541>. PR #97 still
needs the CLI verifier (`scripts/devin-forge/verify.ts`) before merge.
