#!/bin/bash
# transcribe-clips.sh: Whisper word-level transcription of every raw clip, via HyperFrames.
# Usage: bash transcribe-clips.sh "/path/to/shorts" [--use-normalised]
#
# Reads from <shorts>/raw/ (or <shorts>/raw/normalised/ with --use-normalised).
# Writes JSON transcripts to <shorts>/transcripts/<clip-slug>.json.
# Model: $WHISPER_MODEL, default small.en. Set transcription.whisper_model in your settings
# and pass it through for other languages.

set -eu

SHORTS_DIR="${1:?Usage: transcribe-clips.sh <path-to-shorts-dir> [--use-normalised]}"
USE_NORM="${2:-}"
MODEL="${WHISPER_MODEL:-small.en}"

SHORTS_DIR="$(cd "$SHORTS_DIR" && pwd)"
if [ "$USE_NORM" = "--use-normalised" ]; then
  RAW_DIR="$SHORTS_DIR/raw/normalised"
else
  RAW_DIR="$SHORTS_DIR/raw"
fi
OUT_DIR="$SHORTS_DIR/transcripts"

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
echo "Transcribing ${#clips[@]} clip(s) with whisper $MODEL, writing to $OUT_DIR"
echo ""

failed=0
for clip in "${clips[@]}"; do
  filename=$(basename "$clip")
  # Slug: lowercase, spaces to dashes, drop extension. build-compositions.js relies on this.
  slug=$(echo "${filename%.*}" | tr 'A-Z ' 'a-z-')
  outpath="$OUT_DIR/$slug.json"

  if [ -f "$outpath" ]; then
    echo "  ok $filename (already transcribed, skipping)"
    continue
  fi

  echo "  -> $filename"

  # HyperFrames writes transcript.json beside the input in newer versions and into the
  # working directory in older ones, so check both.
  (cd "$SHORTS_DIR" && npx --yes hyperframes transcribe "$clip" --model "$MODEL" 2>&1 | grep -E "(Transcribed|Error|error)" | tail -3) || true

  produced=""
  for cand in "$(dirname "$clip")/transcript.json" "$SHORTS_DIR/transcript.json"; do
    if [ -f "$cand" ]; then produced="$cand"; break; fi
  done

  if [ -n "$produced" ]; then
    mv "$produced" "$outpath"
    echo "    wrote $slug.json"
  else
    echo "    FAILED to produce transcript.json for $filename"
    failed=$((failed + 1))
  fi
done

echo ""
echo "Done. Transcripts at: $OUT_DIR"
[ "$failed" -eq 0 ] || { echo "$failed clip(s) failed." >&2; exit 1; }
