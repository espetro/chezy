# 2026-09-20 — Remotion demo video (`apps/video`)

Video pipeline merged to main across PRs #30, #34, #44. Spec:
`.agents/plans/2026-09-19-demo-video.md`. Render lives at
`apps/video/out/chezy-demo.mp4` (gitignored); latest = ~2:39, 1920x1080.

## Non-obvious learnings

- **pocket-tts has no rate control** — no CLI flag, no serve param, no Python
  API knob, and docs list "silence in text" as unsupported. Punctuation only
  adds pauses, never slows articulation; `--max-tokens` skips words,
  `--frames-after-eos` appends noise. The fix is post-processing: `ffmpeg
  -af atempo=<t>` (pitch-preserving). Wired as `voice.tempo` in
  `demo.config.ts` (shipped 0.88 ≈ 152 wpm; 0.80–0.85 also clean).
  Measured table: `/tmp/chezy-video/tts-speed/findings.md` on this machine.
- **Voice cloning needs the gated HF repo**: `pocket-tts export-voice`
  requires accepting `kyutai/pocket-tts` terms + `hf auth login`. The
  committed `apps/video/voices/chezy-narrator.safetensors` is alba's
  precomputed embedding from the HF snapshot — teammates reuse it directly
  or clone their own (README).
- **audiocpp models live at `~/.cache/audiocpp/models/`** via
  `audiocpp_model_manager install <name>`; `list` needs `--models-dir` to
  report local installs. `brew install 0xshug0/audio-cpp/audio-cpp` for the
  binary (no usable mise backend). Medium model = ~3.6 GB.
- **Sponsor logo extraction**: Luma sponsor images are unlabeled
  "User Uploaded Image" nodes — map them by document order against the
  page JSON, or just eyeball a contact sheet. SLNG wasn't on the page; its
  logo is `logo_slng.svg` on datocms. Dark wordmarks need the light-pill
  treatment in `Badge.tsx` on our dark canvas.
- **Remotion**: free license covers teams <= 3. `<OffthreadVideo>` eats
  Playwright `.webm` directly (variable fps is fine for jump-cut UI).
  `getAudioDurationInSeconds` is deprecated — we use `ffprobe` into
  committed `src/generated/durations.json`. Remotion expects `zod` as a
  peer dep (pinned, never imported by our code).

## Open items

- Real captures: teammates drop 393x852@3x clips into `public/clips/` and
  flip `source.kind` per `apps/video/CAPTURE.md`.
- `SLNG_API_KEY` absent locally; enables the SLNG-TTS narrator swap
  (`POST https://api.slng.ai/v1/tts/slng/deepgram/aura:2-en`) and the real
  viewing call. Repo hardcodes `api.agents.slng.ai`; docs say `api.slng.ai`.
- Polish backlog: sponsor strip legibility (pills landed in #44),
  early-shortlist phone content is sparse, diagram nodes sit low-left.
