#!/bin/bash
# archive-media.sh: after sign-off, move heavy video out of the episode folder.
#
# Usage: bash archive-media.sh "/path/to/Episode N - Guest" "/path/to/archive/Episode N - Guest"
#
# Run last, after /distribute and /podcast-guest-comms: both read the renders from the episode
# folder. Text and small images stay with the episode. Video belongs in the archive.
#
# Moves:   shorts/raw/*.mp4|mov, shorts/renders/*.mp4
# Deletes: composition-*/clip.mov|mp4 (regenerable from raw)
# Stays:   all .md, transcripts/, composition HTML and fonts, thumbnails
# Leaves a MEDIA.md pointer in the shorts folder.

set -eu

EP_DIR="${1:?Usage: archive-media.sh <episode-dir> <archive-episode-dir>}"
ARCHIVE_DIR="${2:?Usage: archive-media.sh <episode-dir> <archive-episode-dir>}"

# A quoted ~ does not expand by itself.
EP_DIR="${EP_DIR/#\~/$HOME}"
ARCHIVE_DIR="${ARCHIVE_DIR/#\~/$HOME}"

if [ ! -d "$(dirname "$ARCHIVE_DIR")" ]; then
  echo "ERROR: archive location not found: $(dirname "$ARCHIVE_DIR"). Create the folder, or if it is on an external drive, check the drive is mounted." >&2
  exit 1
fi
if [ ! -d "$EP_DIR/shorts" ]; then
  echo "ERROR: no shorts/ in $EP_DIR" >&2
  exit 1
fi

mkdir -p "$ARCHIVE_DIR/shorts/raw" "$ARCHIVE_DIR/shorts/renders"

moved=0
shopt -s nullglob
for f in "$EP_DIR/shorts/raw"/*.mp4 "$EP_DIR/shorts/raw"/*.mov "$EP_DIR/shorts/raw"/*.MP4 "$EP_DIR/shorts/raw"/*.MOV; do
  mv "$f" "$ARCHIVE_DIR/shorts/raw/"; moved=$((moved+1))
done
for f in "$EP_DIR/shorts/renders"/*.mp4 "$EP_DIR/shorts/renders"/*.MP4; do
  mv "$f" "$ARCHIVE_DIR/shorts/renders/"; moved=$((moved+1))
done
# Only delete the composition clones once the raws are safely in the archive.
for f in "$EP_DIR/shorts"/composition-*/clip.mov "$EP_DIR/shorts"/composition-*/clip.mp4; do
  rm "$f"; moved=$((moved+1))
done

cat > "$EP_DIR/shorts/MEDIA.md" << EOF
# Media archived

Signed off and moved on $(date +%Y-%m-%d).

- Raw verticals and final renders: \`$ARCHIVE_DIR/shorts/\`
- Composition clip clones were deleted. To rebuild: copy the raws back and re-run build-compositions.js.
EOF

echo "Moved or cleaned $moved media files."
echo "Episode shorts folder now: $(du -sh "$EP_DIR/shorts" | cut -f1)"
echo "Archive shorts folder now: $(du -sh "$ARCHIVE_DIR/shorts" | cut -f1)"
