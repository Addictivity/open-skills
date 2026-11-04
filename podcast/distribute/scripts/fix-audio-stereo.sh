#!/bin/bash
# fix-audio-stereo.sh: copy the left audio channel to the right on rendered MP4s.
# Usage: bash fix-audio-stereo.sh "/path/to/shorts/renders"
#
# Editors often export a mono mic source with audio on the left channel only and silence
# on the right. Phone viewers then hear one ear. This makes the output true centred stereo.
#
# Originals move to <renders>/mono-bak/. Fixed files are written in place.

set -eu

RENDERS_DIR="${1:?Usage: fix-audio-stereo.sh <path-to-renders-dir>}"

if [ ! -d "$RENDERS_DIR" ]; then
  echo "Error: renders dir not found: $RENDERS_DIR" >&2
  exit 1
fi

shopt -s nullglob
files=("$RENDERS_DIR"/*.mp4)

if [ ${#files[@]} -eq 0 ]; then
  echo "No .mp4 files found in $RENDERS_DIR" >&2
  exit 1
fi

mkdir -p "$RENDERS_DIR/mono-bak"
echo "Fixing ${#files[@]} mp4(s): duplicating the left audio channel to the right"
echo ""

failed=0
for f in "${files[@]}"; do
  filename=$(basename "$f")
  if [ -f "$RENDERS_DIR/mono-bak/$filename" ]; then
    echo "  ok $filename (already fixed, skipping)"
    continue
  fi

  echo "  -> $filename"
  mv "$f" "$RENDERS_DIR/mono-bak/$filename"
  if ! ffmpeg -hide_banner -loglevel error \
      -i "$RENDERS_DIR/mono-bak/$filename" \
      -c:v copy \
      -af "pan=stereo|c0=c0|c1=c0" \
      -c:a aac -b:a 192k -ar 48000 \
      "$f"; then
    echo "    FAILED. Restoring original."
    rm -f "$f"
    mv "$RENDERS_DIR/mono-bak/$filename" "$f"
    failed=$((failed + 1))
    continue
  fi

  # Confirm the right channel now has signal.
  peak_r=$(ffmpeg -hide_banner -nostats -i "$f" -filter_complex "[0:a]channelsplit=channel_layout=stereo:channels=FR,astats=metadata=0:reset=0" -f null - 2>&1 | grep -E "Peak level dB" | tail -1 | sed -E 's/.*Peak level dB: *//' || true)
  echo "    ok right channel peak: ${peak_r:-unknown} dB"
done

echo ""
echo "Done. Originals in: $RENDERS_DIR/mono-bak/"
[ "$failed" -eq 0 ] || { echo "$failed file(s) failed." >&2; exit 1; }
