#!/usr/bin/env bash
# Generate the ~40 s loopable ambient bed with audiocpp (Stable Audio 3,
# Metal backend, q8_0 GGUF). One-shot; rerun to regenerate.
# Run via `mise run video:music`, then set music.file = "bed.wav" in
# demo.config.ts to enable MusicBed.
#
# Model: Stable Audio 3 Medium by default (up to ~380 s clips, ~3.6 GB
# download). Pass `small` (or MUSIC_MODEL=small) for the lighter
# Stable-Audio-3-Small-Music package (~1.7 GB, up to ~120 s clips) on
# memory-constrained machines. See docs/music.md for install and
# prompting notes.
#
# Model resolution: audiocpp needs a *model package dir* (the GGUF plus its
# .audiocpp-package marker), installed once via
#   audiocpp_model_manager install stable_audio_3_medium_q8_0
# Packages live in ~/.cache/audiocpp/models (outside any repo checkout).
# A bare HF-cache .gguf path is NOT sufficient — it fails with
# "unsupported tensor source format".
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/public/audio/music"
OUT="$OUT_DIR/bed.wav"
MODELS_DIR="${AUDIOCPP_MODELS_DIR:-$HOME/.cache/audiocpp/models}"
PROMPT="${MUSIC_PROMPT:-minimal ambient electronic, warm soft pads, slow pulse, no drums, no melody hook, 80 bpm}"
DURATION="${MUSIC_DURATION:-40}"

case "${1:-${MUSIC_MODEL:-medium}}" in
  medium)
    PACKAGE_ID="stable_audio_3_medium_q8_0"
    PACKAGE_DIR="Stable-Audio-3-Medium-GGUF"
    ;;
  small)
    PACKAGE_ID="stable_audio_3_small_music_q8_0"
    PACKAGE_DIR="Stable-Audio-3-Small-Music-GGUF"
    ;;
  *)
    echo "unknown model '${1:-$MUSIC_MODEL}' (expected: medium | small)" >&2
    exit 1
    ;;
esac

MODEL="$MODELS_DIR/$PACKAGE_DIR"
if [ ! -d "$MODEL" ]; then
  echo "stable_audio model package not installed. Run:" >&2
  echo "  audiocpp_model_manager install $PACKAGE_ID --models-dir $MODELS_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
audiocpp \
  --task gen \
  --family stable_audio \
  --model "$MODEL" \
  --backend metal \
  --text "$PROMPT" \
  --duration-seconds "$DURATION" \
  --out "$OUT"

echo "wrote $OUT"
