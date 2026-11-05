#!/bin/bash
# render-all.sh: sequential standard-quality render of all compositions in a shorts dir.
# Usage: bash render-all.sh "/path/to/shorts"
#
# Iterates composition-*/index.html and renders each to renders/clip-N-final.mp4.
# Sequential, so Chrome workers do not starve each other.

set -eu -o pipefail
HYPERFRAMES="${HYPERFRAMES:-hyperframes@0.9.16}"  # the version this pack was tested with

command -v ffmpeg >/dev/null || { echo "Error: ffmpeg not found. Install it first (on a Mac: brew install ffmpeg)." >&2; exit 1; }
command -v npx >/dev/null || { echo "Error: npx not found. HyperFrames needs Node 22 or later: https://nodejs.org" >&2; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || { echo "Error: HyperFrames needs Node 22 or later, you have $(node -v)." >&2; exit 1; }

SHORTS_DIR="${1:?Usage: render-all.sh <path-to-shorts-dir>}"

if [ ! -d "$SHORTS_DIR" ]; then
  echo "Error: shorts dir not found: $SHORTS_DIR" >&2
  exit 1
fi
SHORTS_DIR="$(cd "$SHORTS_DIR" && pwd)"
RENDERS_DIR="$SHORTS_DIR/renders"

shopt -s nullglob
comps=("$SHORTS_DIR"/composition-*)

if [ ${#comps[@]} -eq 0 ]; then
  echo "No composition-* folders found in $SHORTS_DIR" >&2
  exit 1
fi

mkdir -p "$RENDERS_DIR"
echo "Rendering ${#comps[@]} composition(s) at standard quality"
echo ""

start_time=$(date +%s)
failed=0

for comp_dir in "${comps[@]}"; do
  comp_name=$(basename "$comp_dir")
  slug="clip-${comp_name#composition-}"
  outpath="$RENDERS_DIR/${slug}-final.mp4"

  if [ -f "$outpath" ]; then
    echo "  ok $comp_name -> $slug-final.mp4 (already rendered, skipping)"
    continue
  fi

  echo "  -> Rendering $comp_name"
  comp_start=$(date +%s)

  if ! (cd "$comp_dir" && npx --yes "$HYPERFRAMES" lint); then
    echo "    LINT FAILED on $comp_name. Skipping."
    failed=$((failed + 1))
    continue
  fi

  if ! (cd "$comp_dir" && npx --yes "$HYPERFRAMES" render --quality standard --output "$outpath" 2>&1 | tail -3); then
    echo "    RENDER FAILED on $comp_name"
    rm -f "$outpath"
    failed=$((failed + 1))
    continue
  fi

  echo "    ok $slug-final.mp4 in $(( $(date +%s) - comp_start ))s"
  echo ""
done

echo "All done in $(( $(date +%s) - start_time ))s. Renders at: $RENDERS_DIR"
[ "$failed" -eq 0 ] || { echo "$failed composition(s) failed." >&2; exit 1; }
