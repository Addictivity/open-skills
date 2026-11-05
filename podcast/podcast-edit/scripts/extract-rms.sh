#!/usr/bin/env bash
# Extract per-window RMS loudness (dB) from the two clean lav mics.
# Output feeds diarize.py and build_edl.py (energy diarisation: who is speaking).
#
# Usage: extract-rms.sh <host_mic.wav> <guest_mic.wav> <out_dir> [window_s] [sample_rate]
#   window_s     default 0.1  (one RMS reading per 100 ms)
#   sample_rate  default 48000 (set to the mics' real rate; check with ffprobe)
#
# Writes: <out_dir>/host_rms.txt and <out_dir>/guest_rms.txt
# Each line pair is "frame: ... pts_time:<t>" then "lavfi.astats.Overall.RMS_level=<dB>".
set -euo pipefail
command -v ffmpeg >/dev/null || { echo "Error: ffmpeg not found. Install it first (on a Mac: brew install ffmpeg)." >&2; exit 1; }
if [ "$#" -lt 3 ]; then
  echo "Usage: extract-rms.sh <host_mic.wav> <guest_mic.wav> <out_dir> [window_s] [sample_rate]" >&2
  exit 1
fi
HOST="$1"; GUEST="$2"; OUT="$3"; WIN="${4:-0.1}"; SR="${5:-48000}"
N=$(python3 -c "print(int(round($SR*$WIN)))")   # samples per window
mkdir -p "$OUT"
one() {  # <in> <out.txt>
  # The ametadata file= option is parsed by ffmpeg's filter syntax, so run from the
  # output folder and use a bare filename: paths with spaces or colons would break it.
  local abs_in
  abs_in="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
  (cd "$OUT" && ffmpeg -hide_banner -loglevel error -nostats -y -i "$abs_in" \
    -af "asetnsamples=n=${N}:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=$2" \
    -f null -)
}
one "$HOST"  "host_rms.txt"
one "$GUEST" "guest_rms.txt"
echo "host  windows: $(grep -c RMS_level "$OUT/host_rms.txt")"
echo "guest windows: $(grep -c RMS_level "$OUT/guest_rms.txt")"
echo "(expect about duration_seconds / $WIN windows; verify against the mic length)"
