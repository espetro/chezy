# `@chezy/video` — chezy demo video

Remotion package that renders the chezy demo video: 1920x1080, 30 fps,
h264 + AAC, hard cap 3:00 (target ~2:40). Spec:
[`.agents/plans/2026-09-19-demo-video.md`](../../.agents/plans/2026-09-19-demo-video.md).
Package rules live in [`AGENTS.md`](AGENTS.md); music generation has its own
guide in [`docs/music.md`](docs/music.md); the real-footage contract for
teammates is the generated [`CAPTURE.md`](CAPTURE.md).

## Toolchain

Everything installs on macOS with two commands: `mise install` (pins from
[`mise.toml`](../../mise.toml)) plus one `brew install` for audio.cpp.

| Tool | Used for | Install |
| --- | --- | --- |
| node, pnpm | Remotion, all `scripts/*.ts` via `tsx` | mise-pinned, `mise install` |
| ffmpeg / ffprobe | `ffprobe` measures each VO WAV into `src/generated/durations.json`; ffmpeg slows each VO WAV via `atempo` in `video:tts` and does the final encode inside `remotion render` | mise-pinned (`ffmpeg = "latest"`) |
| pocket-tts | Narration. `scripts/tts.ts` shells out to `pocket-tts generate` per segment | mise-pinned (`"pypi:pocket-tts" = "3.1.0"`, installed through the uv backend). Fallback: `brew install pocket-tts` (homebrew-core, bottled) |
| audiocpp + audiocpp_model_manager | Music bed. `scripts/music.sh` runs `audiocpp --task gen --family stable_audio` on the Metal backend | `brew install 0xshug0/audio-cpp/audio-cpp` (tap; no usable mise backend, the GitHub release ships split tarballs). Model install and prompting: [`docs/music.md`](docs/music.md) |
| lefthook, oxlint, oxfmt | repo gates | mise-pinned |

Notes on pocket-tts:

- First `generate` run downloads the English model from Hugging Face
  (~1 GB into `~/.cache/huggingface`). Every later run is CPU-local.
- `--voice` takes a built-in voice name (`alba`), an `hf://` path, or a
  local `.safetensors` / `.wav` file (the shipped narrator).
- Built-in voice cloning (a `.wav` input, or `export-voice`) needs the gated
  `kyutai/pocket-tts` HF repo: accept its terms and run `hf auth login`
  once. `.safetensors` voices and built-in names work without it: pocket-tts
  falls back to the public `kyutai/pocket-tts-without-voice-cloning`
  weights and loads the voice state directly, so the shipped
  `voices/anabel.safetensors` narrates on a fresh machine with no HF
  account (verified against an isolated `HF_HOME` with no token).
- The pinned install is the pypi package through mise (`mise install`), not
  brew and not pocket-tts.cpp; `which pocket-tts` should resolve to the mise
  shim.
- pocket-tts has no speaking-rate flag; `voice.tempo` in `demo.config.ts`
  slows each WAV in post via ffmpeg `atempo` (recommended 0.80 to 0.85 for
  narration, 1.0 to disable). Raw pre-atempo WAVs land in
  `public/audio/vo/raw/` (gitignored).

### Narrator voice

`voice.voice` in `src/config/demo.config.ts` is passed to
`pocket-tts --voice`. It accepts:

- A built-in voice name: `alba`, `marius`, `javert`, `jean`, `fantine`,
  `cosette`, `eponine`, `azelma` (plus more; run `pocket-tts generate --help`
  or try a bad name to print the full catalog).
- A path to a `.safetensors` or `.wav` voice file, resolved relative to
  `apps/video` (absolute paths work too), or an `hf://` path.

The default is `voices/anabel.safetensors`: Anabel's cloned voice state,
committed so narration is identical on every machine and nobody else needs
the gated cloning model. `voices/chezy-narrator.safetensors` (alba's
precomputed state) stays in the repo as a fallback. `mise run video:tts`
emits intro-line samples for `alba`/`marius`/`jean` under
`public/audio/vo/samples/` if you want to audition alternates.

The TTS cache key is sha256(voice + text + tempo); for file voices it
hashes the file contents, so pointing at a different file, re-exporting
it, or changing `voice.tempo` regenerates every segment. Just run
`mise run video:tts` again.

### Use your own voice

1. Record 15 to 30 s of clean speech to WAV: QuickTime Player (File > New
   Audio Recording) or Audacity, quiet room, no music. This must be a real
   recording of your voice; `say` output is synthesized speech and is not
   valid source material.
2. One-time: voice cloning needs the gated `kyutai/pocket-tts` model on
   Hugging Face. Accept the terms at
   <https://huggingface.co/kyutai/pocket-tts>, then `hf auth login`
   (or `uvx hf auth login`). Without this, `export-voice` and `--voice`
   with a `.wav` both fail; `.safetensors` files and built-in names do not
   need it.
3. Export the voice: `pocket-tts export-voice you.wav voices/you.safetensors`
   (from `apps/video/`). Committing it is fine; `voices/` is not gitignored.
   You can also skip the export and point `voice.voice` at the `.wav`
   directly; the `.safetensors` just skips the encoding step on every run.
4. Set `voice.voice = "voices/you.safetensors"` in `demo.config.ts` and run
   `mise run video:tts`. The cache sees the new voice and regenerates all
   segments; `mise run video:durations` (or `video:all`) picks up the new
   timings.

## Pipeline

All tasks run from the repo root via `mise run`:

| Task | Does |
| --- | --- |
| `video:tts` | `pocket-tts generate` per segment + ffmpeg `atempo` (`voice.tempo`) -> `public/audio/vo/*.wav`, sha256(text + voice + tempo) cache in `.cache.json`, plus intro samples for `alba`/`marius`/`jean` in `public/audio/vo/samples/` |
| `video:durations` | `ffprobe` each WAV -> `src/generated/durations.json` (committed; the render reads it for frame counts) |
| `video:capture-doc` | Regenerate `CAPTURE.md` from `demo.config.ts` + copy |
| `video:srt` | Captions sidecar -> `out/chezy-demo.srt` |
| `video:check` | Pre-render gate: total <= 175 s, all VO WAVs and clip sources exist |
| `video:music` | `audiocpp` generation -> `public/audio/music/bed.wav` (see `docs/music.md`) |
| `video:preview` | Remotion Studio for scene work |
| `video:render` | `remotion render` -> `out/chezy-demo.mp4`, `--concurrency 2` baked in |
| `video:all` | tts -> durations -> capture-doc -> srt -> check -> render |

Typical flows:

```bash
mise install          # node, pnpm, ffmpeg, pocket-tts, lint toolchain
pnpm install          # workspace deps (remotion et al.)
mise run video:all    # full pipeline end to end
```

Changed a narration line? Edit `vo` in `src/copy/en.json`, rerun
`mise run video:all`. The TTS cache regenerates only the changed segments;
durations, captions and frame counts follow automatically. No hand-timed
frames anywhere.

## Memory budget (8 GB M1)

`video:render` pins `--concurrency 2`. Never run it while Remotion Studio
(`video:preview`) or the Next dev server (`mise run dev`) is up; Chromium
plus Metro plus the TTS model exhausts 8 GB and the render dies mid-write.
Studio for iteration, render for shipping, never both.

## Committed vs generated

- Committed: `src/copy/en.json`, `src/config/demo.config.ts`,
  `src/generated/durations.json`, `voices/`, `CAPTURE.md` (generated, do not
  hand-edit).
- Gitignored: `public/audio/` (VO WAVs, music bed), `public/clips/`
  (teammate captures), `out/` (MP4 + SRT).
