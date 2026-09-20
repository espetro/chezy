# `@chezy/video` — agent instructions

Remotion package producing the chezy demo video (see
`.agents/plans/2026-09-19-demo-video.md`). Teammate-facing setup and the
pipeline walkthrough live in [`README.md`](README.md). Inherits the root
[`AGENTS.md`](../../AGENTS.md) rules — this is chezy code, NOT inside the
`apps/web` exemption: no `zod` (use `valibot`), no `@biomejs/*`, no
`useEffect` (use `useCurrentFrame` / `interpolate` / `spring`), no `process.env`
reads in `src/`, relative imports only.

## Invariants

- Every viewer-facing string lives in `src/copy/en.json`, parsed at module load
  by `src/copy/copy.schema.ts` (valibot). Components and `demo.config.ts` hold
  no literal copy.
- Segment timing is audio-first: `buildTimeline(config, durations)` derives
  frames from `src/generated/durations.json` (committed) plus a per-segment
  tail. Never hardcode frame counts for narration.
- Narration pacing is `voice.tempo` in `demo.config.ts`: an ffmpeg `atempo`
  post-process on each WAV (pocket-tts has no rate control; 0.80 to 0.85 is
  the recommended narration range). It is part of the TTS cache key, so a
  tempo change regenerates every segment.
- App dark tokens live in `src/theme.ts` only.
- `public/audio/`, `public/clips/` and `out/` are gitignored; WAVs and MP4s
  never get committed.
- Fonts in `public/fonts/` and the logo in `public/logo/` are copies; `assets/`
  at the repo root is the source of truth.

## Tasks

All via `mise run` at the repo root: `video:tts`, `video:durations`,
`video:capture-doc`, `video:srt`, `video:check`, `video:preview`,
`video:render`, `video:music`, `video:all`.
