#!/usr/bin/env bash
# Generate the ~40 s loopable ambient bed with audiocpp (Stable Audio 3 Small,
# Metal backend, q8_0 GGUF). One-shot; rerun to regenerate.
# Run via `mise run video:music`, then set music.file = "bed.wav" in
# demo.config.ts to enable MusicBed.
#
# Model resolution: audiocpp needs a *model package dir* (the GGUF plus its
# .audiocpp-package marker), installed once via
#   audiocpp_model_manager install stable_audio_3_small_music_q8_0
# We keep it in ~/.cache/audiocpp/models (outside any repo checkout).
# A bare HF-cache .gguf path is NOT sufficient — it fails with
# "unsupported tensor source format".
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/public/audio/music"
OUT="$OUT_DIR/bed.wav"

MODEL="$(ls -d "$HOME"/.cache/audiocpp/models/Stable-Audio-3-Small-Music-GGUF 2>/dev/null | head -1)"
if [ -z "$MODEL" ]; then
  echo "stable_audio model package not installed. Run:" >&2
  echo "  audiocpp_model_manager install stable_audio_3_small_music_q8_0 --models-dir \$HOME/.cache/audiocpp/models" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
audiocpp \
  --task gen \
  --family stable_audio \
  --model "$MODEL" \
  --backend metal \
  --text "minimal ambient electronic, warm soft pads, slow pulse, no drums, no melody hook, 80 bpm" \
  --duration-seconds 40 \
  --out "$OUT"

echo "wrote $OUT"
