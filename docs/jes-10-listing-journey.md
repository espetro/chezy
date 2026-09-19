# JES-10 listing journey handoff

## Integration

The feature branch integrates JES-7 (`b01e122` / PR #36), JES-11 (`9a0cb21` / PR #38),
and branding/controls PR #32 (`975710b`). Base: `1f8abaf`.

`/explore/[id]` still authenticates and scores on the server. It passes a minimal
`ExplanationSource`, numeric preferences and a `userId:profileUpdatedAt` cache key to
`MatchDetail({ listing, explanation })`. `InsightPanel` mounts JES-7's
`MatchExplanation`; the API still accepts only `listingId`. Unknowns and
deterministic fallback remain visible. The detail score appears once.

The persistent mobile action links to the single viewing-control panel. It does
not dispatch a call. Bottom padding includes the safe-area inset. Price, area and
room counts with missing values are shown as unknown; the adapter's assumed
availability is no longer presented as a confirmed detail fact.

## Dismissal seam for JES-8

- `CandidateDismissHandler = (listingId: string) => void`.
- `CandidateCarousel({ listings, label, onDismiss? })` asks its owner to remove a
  listing. `ExploreFeed` currently owns that local list with `useCandidateDismissal`.
- `AgentCallGate({ listing, onDismiss? })` uses the same local hook for its existing
  discard/undo state and notifies an optional client owner.
- `useCandidateDismissal()` returns `dismissedIds`, `dismissCandidate(id)` and
  `restoreCandidate(id)`.

This is intentionally visit-local state: no storage, API or preference changes.
JES-8 should replace the ownership with its persistent rejection workflow and wire
undo to that workflow, rather than run both mechanisms. Callback props must come
from a client owner, not an ordinary server component.

Carousel exits temporarily make the departing slide inert, then focus the next
remaining card (or the empty message). Undo restores card focus. Existing scroll,
previous/next and indicator controls remain; indicators now have 44px targets.

## Motion and dimensions

`FlowMotion` configures Motion's user reduced-motion setting.
`FlowReveal` reveals the fixed-size detail image. `FlowStateTransition` animates
real viewing-state changes in a fixed, keyboard-scrollable status area.
Carousel dismissal/replacement uses opacity and position transitions.
Normal durations are 160–200ms; reduced motion removes transforms and uses
immediate transitions. Manual scrolling also respects reduced motion.

Image boxes, reason/tag rows, two insight slots, metadata space and call-control
space reserve dimensions. Long status details remain scrollable rather than
being clipped. These reservations are not a substitute for visual acceptance at
375px, desktop and enlarged text.

No successful booking state is invented: JES-11's simulated and dispatched states
keep their exact distinction, and live calls still require explicit authorization.

## Verification boundary

`MatchDetail.test.ts` exercises the production composition through React server
rendering: mounted grounded reasons, over-budget trade-off, missing source facts,
single score and the link to truthful viewing controls. Existing matching,
feed, explanation and viewing tests cover their underlying contracts.

Browser approval was not supplied for this session. Layout, animation timing,
interactive keyboard focus, reduced-motion rendering, screenshots and recording
remain to be verified in the browser. Live Nebius/SLNG proof belongs to their
respective tickets and is not supplied by deterministic fallback or SSR tests.
