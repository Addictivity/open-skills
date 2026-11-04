#!/bin/bash
# normalise-audio.sh: ffmpeg loudness normalisation to -14 LUFS for social platforms.
# Usage: bash normalise-audio.sh "/path/to/shorts/raw"
#
# Writes normalised copies to <raw>/normalised/<filename>, leaving originals untouched.
# Target: -14 LUFS integrated, -1 dBTP true peak, 11 LU loudness range.

set -eu

RAW_DIR="${1:?Usage: normalise-audio.sh <path-to-raw-dir>}"
OUT_DIR="$RAW_DIR/normalised"

if [ ! -d "$RAW_DIR" ]; then
  echo "Error: raw dir not found: $RAW_DIR" >&2
  exit 1
fi

shopt -s nullglob
clips=("$RAW_DIR"/*.mov "$RAW_DIR"/*.mp4 "$RAW_DIR"/*.MOV "$RAW_DIR"/*.MP4)

if [ ${#clips[@]} -eq 0 ]; then
  echo "No .mov or .mp4 files found in $RAW_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
echo "Normalising ${#clips[@]} clip(s) to -14 LUFS, writing to $OUT_DIR"
echo ""

failed=0
for clip in "${clips[@]}"; do
  filename=$(basename "$clip")
  outpath="$OUT_DIR/$filename"

  if [ -f "$outpath" ]; then
    echo "  ok $filename (already normalised, skipping)"
    continue
  fi

  echo "  -> $filename"

  # Single-pass loudnorm is good enough for short-form social content. It works at 192kHz
  # internally, so set the output rate. MP4 does not reliably carry PCM, so MP4 gets AAC.
  case "$filename" in
    *.mp4|*.MP4) codec=(-c:a aac -b:a 256k) ;;
    *)           codec=(-c:a pcm_s24le) ;;
  esac
  if ! ffmpeg -hide_banner -loglevel error -i "$clip" \
      -af "loudnorm=I=-14:TP=-1:LRA=11" -ar 48000 -c:v copy "${codec[@]}" "$outpath"; then
    echo "    FAILED on $filename"
    rm -f "$outpath"
    failed=$((failed + 1))
  fi
done

echo ""
echo "Done. Normalised clips at: $OUT_DIR"
[ "$failed" -eq 0 ] || { echo "$failed clip(s) failed." >&2; exit 1; }
