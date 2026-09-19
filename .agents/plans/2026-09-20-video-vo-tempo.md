# Demo video: slow the narration (voice.tempo)

Date: 2026-09-20. Branch: `feat/chezy-0-video-tempo`.

## Problem

The rendered demo lands at ~1:50; target is ~2:15 to 2:40. pocket-tts has
no speaking-rate control (verified in /tmp/chezy-video/tts-speed/findings.md),
so pacing is a post-process: ffmpeg `atempo` on each synthesized WAV.
atempo 0.80 to 0.85 is clean for VO (~140 to 149 wpm vs ~172 baseline).

## Changes

- `src/config/demo.config.ts`: `voice` gains a `tempo: number` field,
  shipped at 0.82.
- `src/config/timeline.ts`: `DEFAULT_TAIL_FRAMES` 15 to 24 (slower VO earns
  a touch more breathing room per segment).
- `scripts/tts.ts`: synthesize to `public/audio/vo/raw/` (gitignored via
  `public/audio/`), then `ffmpeg -af atempo=<tempo>` into the final WAV.
  Cache key becomes sha256(voice + text + tempo) so a tempo change
  regenerates every segment.
- Docs: README toolchain/VO notes + AGENTS.md invariants get the tempo
  knob line.
- Regenerate `src/generated/durations.json` (committed) via
  `mise run video:durations`.

## Verification

`mise run video:tts` -> `video:durations` -> `video:check` (total must be
130 to 170 s, cap stays 175 s) -> `video:render`. ffprobe each final WAV
and confirm ~1/tempo x the raw file; ffprobe the mp4 for duration + audio
streams. Lint: oxlint/oxfmt on changed files + `mise run validate:quick`.
