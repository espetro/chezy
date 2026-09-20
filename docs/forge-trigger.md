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

<!-- live run: session URL / PR URL -->
