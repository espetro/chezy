# Live call stages and retry recovery

Date: 2026-09-20

## Scope

Read SLNG call records while a viewing is dispatched, expose provider-backed stages
and transcripts to the flow, and mark ended calls failed after a short webhook grace
period so a retry dispatches a fresh call.

## Implementation

- Add defensive SLNG call snapshot parsing and focused unit coverage.
- Extend the viewing status route with stage, transcript, terminal detection, and
  safe logging.
- Add a controller `abandon` transition that clears the persisted dispatch receipt.
- Propagate status details/transcripts through the booking hook and render them in
  the detail gate and candidate card.

## Verification

- Run the requested focused SLNG/viewing Vitest files.
- Run `mise run validate:quick`.
- Commit the focused changes with Conventional Commits and push the feature branch;
  do not wait for CI.
