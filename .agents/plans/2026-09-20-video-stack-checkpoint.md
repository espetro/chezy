# Plan: video tempo 0.88 + "stack" final checkpoint

Date: 2026-09-20. Branch: feat/chezy-0-video-stack.

## Scope

1. `voice.tempo` 0.82 -> 0.88 in `apps/video/src/config/demo.config.ts`.
2. New final checkpoint `stack` ("How it works") after `booked`:
   - `CheckpointId` += `"stack"`; `Checkpoint` += `showPhone?: boolean`
     (default true; false renders the scene full-zone, no PhoneFrame).
   - en.json + copy.schema.ts: `checkpoints.stack` with `screen.nodes`
     (6 diagram nodes, optional `sub`/`logo`), `calendar`, `credit`.
   - `src/scenes/placeholders/Stack.tsx`: Remotion-native left-to-right
     pipeline diagram (nodes + animated flow edges + calendar branch +
     Cognition/QualityClouds credit chip), staggered ~2.5s node fades.
   - `SplitScreenDemo`: full-zone scene when `showPhone === false`;
     callout moves to top-left; footer gated on
     `index === config.checkpoints.length - 1` (lands on `stack`).
   - `CheckpointSidebar`: spacing tuned for 6 items.

## Verify

`mise run video:tts && video:durations && video:check && video:render`
(+ capture-doc, srt). Target total ~155-170s, cap 175s. Frame grab inside
the stack segment to eyeball the diagram. oxlint/oxfmt + validate:quick.

## Commits

1. feat(video): stack checkpoint + diagram scene + dynamic footer
2. feat(video): narrator tempo 0.88
3. chore(video): regenerated durations.json (+ CAPTURE.md doc commit)
