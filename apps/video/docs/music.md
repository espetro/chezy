# Music bed: audio.cpp + Stable Audio 3

The demo video's ambient bed is generated locally with
[audio.cpp](https://github.com/0xShug0/audio.cpp), a ggml-based audio
inference engine that runs the GGUF port of Stable Audio 3 on the Metal
backend. Output lands at `public/audio/music/bed.wav` (gitignored) and is
picked up by `MusicBed` when `music.file = "bed.wav"` in
`src/config/demo.config.ts`: it loops under the whole video, ducked to
-24 dB while narration plays and -14 dB in the gaps (15-frame ramps).

## Install

```bash
brew install 0xshug0/audio-cpp/audio-cpp
```

The tap installs two binaries: `audiocpp` (the CLI) and
`audiocpp_model_manager` (model package manager). There is no mise pin for
audio.cpp: it is not in the mise registry, and its GitHub releases ship the
CLI, model manager and framework as separate tarballs the `github` backend
cannot assemble into a working install. Homebrew is the supported path.

## Model packages

`audiocpp` does not load a bare `.gguf`. It needs a *model package* (the
GGUF plus an `.audiocpp-package` marker) installed by the model manager;
pointing `--model` at a raw HF-cache file fails with
`unsupported tensor source format`.

```bash
audiocpp_model_manager list --remote          # JSON catalog of packages
audiocpp_model_manager info <package-id>      # details for one package
audiocpp_model_manager install <package-id>   # download into the models dir
audiocpp_model_manager remove <package-id>    # delete a package
```

Packages live in `~/.cache/audiocpp/models` by default (outside any repo
checkout; override with `--models-dir` or `AUDIOCPP_MODELS_DIR`). Quirk:
`audiocpp_model_manager list` reports `installed` only when the models dir
is passed explicitly, so check local state with
`audiocpp_model_manager list --models-dir ~/.cache/audiocpp/models`.

For this video install Stable Audio 3 Medium:

```bash
audiocpp_model_manager install stable_audio_3_medium_q8_0
```

That is ~3.6 GB and lands at `~/.cache/audiocpp/models/Stable-Audio-3-Medium-GGUF`.
It is the default in `scripts/music.sh` and generates clips up to ~380 s.
The lighter alternative is Small:

```bash
audiocpp_model_manager install stable_audio_3_small_music_q8_0   # ~1.7 GB
```

Small tops out around ~120 s per clip and is the right fallback if Medium
makes an 8 GB machine swap.

## Generate

```bash
mise run video:music                        # Medium, default prompt, 40 s
```

To pick Small, set the env var or call the script directly:

```bash
MUSIC_MODEL=small mise run video:music
bash apps/video/scripts/music.sh small
```

`scripts/music.sh` wraps:

```bash
audiocpp \
  --task gen --family stable_audio \
  --model ~/.cache/audiocpp/models/Stable-Audio-3-Medium-GGUF \
  --backend metal \
  --text "<prompt>" --duration-seconds 40 \
  --out public/audio/music/bed.wav
```

Overrides: `MUSIC_MODEL` (`medium`|`small`), `MUSIC_PROMPT`,
`MUSIC_DURATION`, `AUDIOCPP_MODELS_DIR`. Regenerate any time; nothing is
cached. The clip is looped by `MusicBed`, so 40 s that tolerates a restart
is all we need.

## Prompting guide

Distilled from the Stable Audio 3 paper; worth reading the "what to avoid"
list before burning a generation.

How conditioning works: the text prompt goes through a frozen text
encoder, and the requested duration is a *separate* conditioning signal.
During training, prompts were assembled by joining metadata fields with
commas (instruments, genre, moods, BPM, short descriptions), sometimes
with the field name attached (`Instruments: ...`, `Moods: ...`). So the
model responds best to dense, comma-joined descriptor lists rather than
prose sentences.

What the text conditioning rewards:

- Instrumentation, named explicitly (`felt piano`, `synth pads`,
  `sustained strings`).
- Genre and style words (`minimal ambient`, `ambient electronic`,
  `lo-fi`).
- Mood (`calm`, `hopeful`, `tense`).
- Tempo as a BPM number (`80 bpm`).
- Structure and arrangement cues (`sparse arrangement`, `slow pulse`,
  `steady texture`).
- Production descriptors (`warm`, `soft dynamics`, `tape hiss`).
- Field-style prefixes match the training format and work well:
  `Instruments: synth pads, Moods: calm`. The authors also recommend
  prefixing music prompts with `TrackType: Music, VocalType:
  Instrumental,` (and `TrackType: SFX,` for effects); it measurably
  improves generation quality.

Duration conditioning: `--duration-seconds` controls both the output
length and how much compute is allocated (cost scales with requested
length). Prompt adherence is strongest at intermediate lengths (~2-3 min).
Very short clips degrade because short training examples were mostly
loops; near the model's maximum length adherence drops because long
training examples skew ambient and classical, which can override the
prompt. For our bed, generating ~40 s and looping is safer than asking
Medium for the full ~170 s of video.

What to avoid:

- Artist, band or track names. The model is trained on licensed and
  Creative Commons data; names are unreliable and a licensing smell.
- Lyrics or vocal demands. Stable Audio 3 is an instrumental model.
- Abrupt percussion, drum kits, or strong melodic hooks for a bed under
  voiceover; they fight the narration even at -24 dB. Favor pads, drones,
  slow pulses and steady textures.
- Kitchen-sink prompts. If a run ignores part of the prompt, shorten it;
  long descriptor lists dilute each other.

Worked examples for demo-video beds:

```text
TrackType: Music, VocalType: Instrumental, minimal ambient electronic, warm soft pads, slow pulse, no drums, no melody hook, 80 bpm
```

```text
TrackType: Music, VocalType: Instrumental, Instruments: felt piano, soft synth pads, Moods: calm, hopeful, sparse arrangement, 70 bpm, soft dynamics
```

```text
TrackType: Music, VocalType: Instrumental, lo-fi ambient texture, warm low-end drone, sustained strings, gentle tape hiss, no percussion, 60 bpm
```

Try them via `MUSIC_PROMPT="..." mise run video:music`, or edit the
default in `scripts/music.sh` once one sticks.
