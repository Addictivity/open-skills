#!/bin/bash
# run-offline.sh: exercise every script with no accounts, keys or network calls.
# Fixtures are made up and generated in a temp folder, using ffmpeg for media.
#
# Usage: bash podcast/tests/run-offline.sh
# Needs: node, python3, ffmpeg. Tests that need Python packages use the venvs from the setup
# steps if they exist, or PYTHON if you set it, and are skipped if the packages are not there.

set -u
PODCAST="$(cd "$(dirname "$0")/.." && pwd)"
PY="${PYTHON:-python3}"
PY_TR="${PYTHON:-$HOME/.claude/skills/podcast-transcript/.venv/bin/python}"; [ -x "$PY_TR" ] || PY_TR="$PY"
PY_YT="${PYTHON:-$HOME/.claude/skills/distribute/.venv/bin/python}"; [ -x "$PY_YT" ] || PY_YT="$PY"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
pass=0; fail=0; skip=0

ok()   { pass=$((pass+1)); echo "  pass: $1"; }
bad()  { fail=$((fail+1)); echo "  FAIL: $1"; [ -n "${2:-}" ] && echo "$2" | sed 's/^/        /'; }
# check <label> <command...>: passes if the command exits 0.
check() { local label="$1"; shift; local out; if out="$("$@" 2>&1)"; then ok "$label"; else bad "$label" "$out"; fi; }
# refuses <label> <expected text> <command...>: passes if it exits non-zero and prints the text.
refuses() { local label="$1" want="$2"; shift 2; local out; if out="$("$@" 2>&1)"; then bad "$label (should have failed)" "$out"; elif echo "$out" | grep -q "$want"; then ok "$label"; else bad "$label (wrong message)" "$out"; fi; }

# --- Fixtures ---------------------------------------------------------------
EP="$T/Episode 2 - Tamsin Vell"
mkdir -p "$EP/shorts/raw" "$EP/shorts/transcripts" "$EP/shorts/renders" "$EP/distribute"
node -e '
  const fs = require("fs");
  const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  c.paths.episodes_root = process.argv[2];
  c.paths.env_file = process.argv[2] + "/no-such.env";
  c.paths.google_client_secret = process.argv[2] + "/no-such-client.json";
  c.paths.tokens_dir = process.argv[2] + "/tokens";
  c.publishing.youtube.channel_id = "CHANNEL_EXPECTED";
  c.show.slug = "test-show";
  fs.writeFileSync(process.argv[2] + "/config.json", JSON.stringify(c));
' "$PODCAST/config.example.json" "$T"
export PODCAST_CONFIG="$T/config.json"

cat > "$EP/README.md" <<'EOF'
---
title: Episode 2 - Tamsin Vell
episode: 2
guest: Tamsin Vell
guest_role: Founder
guest_company: Quillfen Coffee
guest_linkedin: https://www.linkedin.com/in/example/
---
EOF
cat > "$EP/clips.md" <<'EOF'
# Episode 2 - Short-form Clips

## Clip 1 - We lost the account on a phone call

**Pull quote (verbatim):**
> "They rang on a Tuesday."

**LinkedIn hook (line 1):**
> They rang on a Tuesday. 🎙

**LinkedIn caption:**
> They rang on a Tuesday.
>
> Tamsin Vell on what she changed next. Link in comments.

**On-screen text:**
- 00:01 - 00:05: `They rang on. a Tuesday.` @Tuesday
- 00:06 - 00:09: `VAT = ROI. Second Roast Everything.` @everything

**Cut style:** Talking head.

---

## Clip 2 - Quilfen pricing

**LinkedIn hook (line 1):**
> The price nobody wanted to change.

**LinkedIn caption:**
> The price nobody wanted to change.

**On-screen text:**
- 00:01 - 00:05: `No anchor here. price.`

## Posting order

| Slot | When | Clip | Reason |
|------|------|------|--------|
| 1 | Week 1 | Clip 2 Pricing | Launch clip |
| 2 | Week 1 | Clip 1 Account | Story |
EOF
cat > "$EP/youtube-description.md" <<'EOF'
## Title options

1. **A title**

## Tags (paste into YouTube backend)

```
coffee roasting, wholesale coffee, tamsin vell
```

## Notes for the user
EOF
WORDS='[{"text":"They","start":0.5,"end":0.7},{"text":"rang","start":0.7,"end":1},{"text":"on","start":1,"end":1.2},{"text":"a","start":1.2,"end":1.3},{"text":"Tuesday.","start":1.3,"end":2},{"text":"Quilfen","start":2.5,"end":3},{"text":"everything","start":7,"end":7.5}]'
echo "$WORDS" > "$EP/shorts/transcripts/clip-1.json"
echo "$WORDS" > "$EP/shorts/transcripts/clip-2.json"

# Ten seconds of black video with left-only audio, as an editor might export it.
ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=black:s=108x192:r=30:d=10 \
  -f lavfi -i "sine=frequency=440:duration=10" \
  -filter_complex "[1:a]pan=stereo|c0=c0|c1=0*c0[a]" -map 0:v -map "[a]" -c:v libx264 -c:a aac -shortest "$EP/shorts/raw/clip-1.mp4"
cp "$EP/shorts/raw/clip-1.mp4" "$EP/shorts/raw/clip-2.mp4"
ffmpeg -hide_banner -loglevel error -i "$EP/shorts/raw/clip-1.mp4" -c:v copy -c:a pcm_s24le "$T/clip-mov.mov"

# Two mics that take turns: host loud 0-20s, guest loud 20-60s, host 60-65s, guest 65-100s.
ffmpeg -hide_banner -loglevel error -f lavfi -i "sine=frequency=300:duration=100:sample_rate=48000" -af "volume='if(lt(t,20)+between(t,60,65),0.5,0.001)':eval=frame" "$T/host.wav"
ffmpeg -hide_banner -loglevel error -f lavfi -i "sine=frequency=300:duration=100:sample_rate=48000" -af "volume='if(lt(t,20)+between(t,60,65),0.001,0.5)':eval=frame" "$T/guest.wav"

# --- Settings ---------------------------------------------------------------
echo "Settings"
check "config.example.json is valid JSON" node -e "JSON.parse(require('fs').readFileSync('$PODCAST/config.example.json','utf8'))"
refuses "missing settings file is explained" "settings file not found" env PODCAST_CONFIG="$T/nope.json" node "$PODCAST/distribute/scripts/build-youtube-metadata.js" --episode-dir "$EP"

echo "Missing tools"
for s in shorts/scripts/normalise-audio.sh distribute/scripts/fix-audio-stereo.sh shorts/scripts/render-all.sh shorts/scripts/transcribe-clips.sh; do
  refuses "$(basename "$s") names ffmpeg" "ffmpeg not found" env PATH=/nonexistent /bin/bash "$PODCAST/$s" "$T"
done
refuses "extract-rms.sh names ffmpeg" "ffmpeg not found" env PATH=/nonexistent /bin/bash "$PODCAST/podcast-edit/scripts/extract-rms.sh" a b "$T"

# --- podcast-edit -----------------------------------------------------------
echo "podcast-edit"
mkdir -p "$T/my rms"
check "extract-rms.sh handles a folder with a space" bash "$PODCAST/podcast-edit/scripts/extract-rms.sh" "$T/host.wav" "$T/guest.wav" "$T/my rms"
check "diarize.py splits the talk time" bash -c "'$PY' '$PODCAST/podcast-edit/scripts/diarize.py' '$T/my rms/host_rms.txt' '$T/my rms/guest_rms.txt' --json '$T/segs.json' | grep -E 'talk time: host 2[0-9]s  guest 7[0-9]s'"
node -e '
  const fs = require("fs");
  const t = process.argv[1];
  const c = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  c.rms = { host: t + "/my rms/host_rms.txt", guest: t + "/my rms/guest_rms.txt" };
  c.offsets = { wide: 0, host_cam: 10, guest_cam: -5, host_mic: 0, guest_mic: 0 };
  c.kept_M = [[0, 1200], [1300, 2499]];
  fs.writeFileSync(t + "/edit.json", JSON.stringify(c));
' "$T" "$PODCAST/podcast-edit/references/episode-edit.example.json"
check "build_edl.py builds an EDL" "$PY" "$PODCAST/podcast-edit/scripts/build_edl.py" "$T/edit.json" --out "$T/final_build.json"
check "EDL obeys its rules" node -e '
  const b = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const assert = require("assert");
  assert.strictEqual(b.total, 1200 + 1199);
  assert.strictEqual(b.wide.length, 2);
  assert.strictEqual(b.wide[1].startFrame, 1200);
  assert.strictEqual(b.host_mic[1].trimStartFrame, 1300);
  assert.ok(b.overlay.length > 2);
  const minShot = Math.round(1.6 * 25), minWide = Math.round(1.4 * 25);
  b.overlay.forEach((e, i) => {
    assert.ok(e.durationFrames >= minShot, "shot under the floor at " + i);
    if (i) {
      const gap = e.startFrame - (b.overlay[i-1].startFrame + b.overlay[i-1].durationFrames);
      assert.ok(gap === 0 || gap >= minWide, "flash gap " + gap + " at " + i);
    }
  });
  const last = b.overlay[b.overlay.length - 1];
  const tail = b.total - (last.startFrame + last.durationFrames);
  assert.ok(tail === 0 || tail >= minWide, "thin tail " + tail);
' "$T/final_build.json"

# --- podcast-transcript -----------------------------------------------------
echo "podcast-transcript"
refuses "missing Python packages are explained" "Set up the venv" python3 -S "$PODCAST/podcast-transcript/scripts/transcribe.py" --help
if "$PY_TR" -c "import requests, dotenv" 2>/dev/null; then
  PY_STD="$PY"; PY="$PY_TR"
  TR="$PODCAST/podcast-transcript/scripts/transcribe.py"
  check "--help works" "$PY" "$TR" --help
  check "dry run with no key makes no calls" bash -c "env -u ASSEMBLYAI_API_KEY '$PY' '$TR' --input-file '$T/host.wav' --output-dir '$EP' --guest-name 'Tamsin Vell' --dry-run | grep 'API key MISSING'"
  refuses "real run with no key stops" "ASSEMBLYAI_API_KEY not found" env -u ASSEMBLYAI_API_KEY "$PY" "$TR" --input-file "$T/host.wav" --output-dir "$EP" --guest-name "Tamsin Vell"
  refuses "real run with the placeholder key stops" "still the placeholder" env ASSEMBLYAI_API_KEY=your-assemblyai-key "$PY" "$TR" --input-file "$T/host.wav" --output-dir "$EP" --guest-name "Tamsin Vell"
  refuses "missing ffprobe stops before any cost" "ffprobe not found" env PATH=/nonexistent "$(command -v "$PY")" "$TR" --input-file "$T/host.wav" --output-dir "$EP" --guest-name "Tamsin Vell" --dry-run
  refuses "cost cap stops the run" "exceeds cap" "$PY" "$TR" --input-file "$T/host.wav" --output-dir "$EP" --guest-name "Tamsin Vell" --cost-cap-usd 0.0001 --dry-run
  check "request body, polling and outputs (API mocked)" "$PY" - "$TR" "$T/tr-out" <<'PYEOF'
import importlib.util, json, sys
from pathlib import Path
from unittest import mock
spec = importlib.util.spec_from_file_location("transcribe", sys.argv[1])
tr = importlib.util.module_from_spec(spec); spec.loader.exec_module(tr)
out = Path(sys.argv[2]); out.mkdir()

body = tr.transcript_request_body("u", "universal-2", "en")
assert "auto_chapters" not in body, "auto_chapters is deprecated"
assert body["speech_understanding"]["request"]["summarization"]["summary_type"] == "paragraph"
assert body["speaker_labels"] is True and body["speech_models"] == ["universal-2"]

assert tr.format_timestamp(61000) == "01:01" and tr.format_timestamp(3661000) == "01:01:01"
m = tr.build_speaker_map([{"speaker": "B"}, {"speaker": "A"}, {"speaker": "C"}], "Host", "Guest")
assert m == {"B": "Host", "A": "Guest", "C": "Guest 2"}

done = {
    "status": "completed", "text": "Hello there friend", "audio_duration": 125,
    "utterances": [{"speaker": "A", "start": 0, "text": "Hello"}, {"speaker": "B", "start": 62000, "text": "there friend"}],
    "words": [{"text": "Hello", "start": 0, "end": 400, "speaker": "A", "confidence": 0.9}],
    "speech_understanding": {"response": {"summarization": {"summary": [
        {"start": 0, "end": 60000, "headline": "Opening", "text": "They say hello."}]}}},
}
def resp(payload):
    r = mock.Mock(ok=True); r.json.return_value = payload; return r
with mock.patch.object(tr.requests, "get", return_value=resp(done)):
    t = tr.poll_transcript("key", "id")
sm = tr.build_speaker_map(t["utterances"], "Sam Host", "Tamsin Vell")
clean = tr.write_clean(t, sm, out, 2, "Tamsin Vell", "Sam Host", "example-show").read_text()
assert "[01:02] **Tamsin Vell:** there friend" in clean and "duration_seconds: 125" in clean
assert 'speakers: ["Sam Host", "Tamsin Vell"]' in clean and "business" not in clean
ch = tr.write_chapters(t, out, 2, "Tamsin Vell").read_text()
assert "00:00 Opening" in ch and "They say hello." in ch
words = json.loads(tr.write_words(t, out).read_text())
assert words[0]["end"] == 400 and "confidence" not in words[0]
none = tr.write_chapters({"status": "completed"}, out, 2, "Tamsin Vell").read_text()
assert "no sections" in none

err = mock.Mock(ok=True); err.json.return_value = {"status": "error", "error": "bad audio"}
with mock.patch.object(tr.requests, "get", return_value=err):
    try:
        tr.poll_transcript("key", "id"); raise SystemExit("should have raised")
    except RuntimeError as e:
        assert "bad audio" in str(e)
PYEOF
  PY="$PY_STD"
else
  skip=$((skip+1)); echo "  skip: transcribe.py tests (no requests or dotenv: do the Python packages step in podcast/README.md)"
fi

# --- thumbnail-generate -----------------------------------------------------
echo "thumbnail-generate"
GEN="$PODCAST/thumbnail-generate/scripts/generate.py"
# A 1x1 transparent PNG is enough to stand in for a cutout.
"$PY" -c "import base64,sys; open(sys.argv[1],'wb').write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='))" "$EP/guest-cutout.png"
check "dry run writes the HTML" "$PY" "$GEN" --episode-folder "$EP" --guest-name "Tamsin Vell" --hook "THE ROAST|_NOBODY|_WANTED|*TO BUY" --dry-run
check "HTML has no unfilled placeholders" bash -c "! grep -q '{{' '$EP/thumbnail.html'"
check "thumbnail uses the settings colours" bash -c "grep -q 'background: #141414' '$EP/thumbnail.html' && grep -q 'background: #2B2B2B' '$EP/thumbnail.html'"
check "solo layout drops the host" bash -c "grep -q '68%' '$EP/thumbnail.html' && ! grep -q 'class=\"host\"' '$EP/thumbnail.html'"
refuses "hook needs one highlight" "exactly one highlight" "$PY" "$GEN" --episode-folder "$EP" --guest-name "D" --hook "A|_B" --dry-run
refuses "hook rejects full stops" "no full stops" "$PY" "$GEN" --episode-folder "$EP" --guest-name "D" --hook "A.|*B" --dry-run
refuses "missing cutout is explained" "guest cutout not found" "$PY" "$GEN" --episode-folder "$T" --guest-name "D" --hook "*A" --dry-run

# --- shorts -----------------------------------------------------------------
echo "shorts"
sed 's/@Tuesday/@Wednesday/' "$EP/clips.md" > "$T/bad-anchor.md"
S="$PODCAST/shorts/scripts"
cp "$T/clip-mov.mov" "$EP/shorts/raw/extra.mov"
check "normalise-audio.sh handles mp4 and mov" bash "$S/normalise-audio.sh" "$EP/shorts/raw"
check "normalised files play and hold the rate" bash -c "for f in clip-1.mp4 extra.mov; do ffprobe -v error -show_entries stream=sample_rate -of csv=p=0 '$EP/shorts/raw/normalised/'\$f | grep -q 48000 || exit 1; done"
rm -rf "$EP/shorts/raw/normalised" "$EP/shorts/raw/extra.mov"
check "build-compositions.js builds two clips" node "$S/build-compositions.js" --episode-dir "$EP"
check "compositions are filled in" bash -c "! grep -q '{{' '$EP/shorts/composition-1/index.html' && grep -q 'id=\"clip-2\"' '$EP/shorts/composition-2/index.html' && test -f '$EP/shorts/composition-1/fonts/Gelasio-Variable.ttf' && test -f '$EP/shorts/composition-1/clip.mov'"
check "shorts use the settings colours" bash -c "for c in '#D4D4D4' '#FFFFFF' '#A8A8A8' '#2B2B2B'; do grep -q \"\$c\" '$EP/shorts/composition-1/index.html' || exit 1; done"
check "beats and glossary are applied" node -e '
  const html = require("fs").readFileSync(process.argv[1], "utf8");
  const beats = JSON.parse(html.match(/var BEATS = (\[.*?\]);/)[1]);
  const words = JSON.parse(html.match(/var WORDS = (\[.*?\]);/)[1]);
  const assert = require("assert");
  assert.strictEqual(beats[0].accent, "They rang on");
  assert.strictEqual(beats[0].main, "a tuesday");
  assert.strictEqual(beats[0].start, 0.9);
  assert.ok(beats[1].start >= beats[0].end + 0.4, "beats must not stack");
  assert.ok(words.some(w => w.text === "Quillfen"), "glossary fix missing");
' "$EP/shorts/composition-1/index.html"
check "text rules hold" node -e '
  const b = require(process.argv[1]);
  const assert = require("assert");
  assert.deepStrictEqual(b.splitAccentMain("He told me his. margin."), { accent: "He told me his", main: "margin" });
  assert.strictEqual(b.splitAccentMain("Is it. working?").main, "working?");
  assert.strictEqual(b.lowercaseMain("VAT = ROI Then"), "VAT = ROI then");
  const three = b.splitAccentMain("Well. one two three.");
  assert.strictEqual(three.main, "two three");
  assert.strictEqual(three.accent, "Well one");
  assert.strictEqual(b.clipNumber("CLIP 12.mov"), 12);
  assert.strictEqual(b.clipNumber("clip-3.mp4"), 3);
  assert.strictEqual(b.clipNumber("Timeline 5.mov"), null);
' "$S/build-compositions.js"
touch "$EP/shorts/renders/clip-1-final.mp4"
mkdir -p "$T/archive"
cp -R "$EP" "$T/ep-copy"
check "archive-media.sh moves media and leaves a pointer" bash -c "bash '$S/archive-media.sh' '$T/ep-copy' '$T/archive/ep' && test -f '$T/archive/ep/shorts/raw/clip-1.mp4' && test -f '$T/ep-copy/shorts/MEDIA.md' && test ! -f '$T/ep-copy/shorts/composition-1/clip.mov' && test -f '$T/ep-copy/shorts/composition-1/index.html'"
refuses "missing anchor stops the build" "Not ready to render" node "$S/build-compositions.js" --episode-dir "$EP" --clips-spec "$T/bad-anchor.md"
refuses "archive stops if the drive is missing" "check the drive is mounted" bash "$S/archive-media.sh" "$EP" "/Volumes/NoSuchDrive-$$/ep"
rm -f "$EP/shorts/renders/clip-1-final.mp4"

# --- distribute -------------------------------------------------------------
echo "distribute"
D="$PODCAST/distribute/scripts"
cp "$EP/shorts/raw/clip-1.mp4" "$EP/shorts/renders/clip-1-final.mp4"
cp "$EP/shorts/raw/clip-2.mp4" "$EP/shorts/renders/clip-2-final.mp4"
check "fix-audio-stereo.sh runs" bash "$D/fix-audio-stereo.sh" "$EP/shorts/renders"
check "right channel now has signal" bash -c "ffmpeg -hide_banner -nostats -i '$EP/shorts/renders/clip-1-final.mp4' -filter_complex '[0:a]channelsplit=channel_layout=stereo:channels=FR,volumedetect' -f null - 2>&1 | grep -E 'max_volume: -[0-9]' | grep -v 'inf'"
check "second stereo run skips finished files" bash -c "bash '$D/fix-audio-stereo.sh' '$EP/shorts/renders' | grep 'already fixed'"
mv "$EP/shorts/renders/mono-bak" "$T/mono-bak"

check "build-youtube-metadata.js runs" node "$D/build-youtube-metadata.js" --episode-dir "$EP"
check "metadata is built from clips and settings" node -e '
  const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const assert = require("assert");
  assert.deepStrictEqual(Object.keys(m), ["clip-1", "clip-2"]);
  assert.ok(m["clip-1"].title.startsWith("They rang on a Tuesday"));
  assert.ok(!/\p{Extended_Pictographic}/u.test(m["clip-1"].title), "emoji in title");
  assert.ok(!/link in comments/i.test(m["clip-1"].description));
  assert.ok(m["clip-1"].description.includes("Host: Sam Host"));
  assert.ok(m["clip-1"].description.includes("#exampleshow"));
  assert.ok(m["clip-1"].tags.includes("coffee roasting"), "tags from the Tags section are missing");
  assert.ok(m["clip-1"].tags.includes("Example Show"));
  assert.ok(m["clip-1"].tags.join(",").length <= 500);
  assert.ok(!m["clip-1"].tags.some(t => t.includes("`")));
' "$EP/distribute/youtube-metadata.json"

check "a quoted ~ in --episode-dir works" env HOME="$T" node "$D/build-youtube-metadata.js" --episode-dir "~/$(basename "$EP")"
check "upload dry run calls nothing and writes nothing" bash -c "node '$D/upload-all-to-youtube.js' --episode-dir '$EP' --dry-run | grep 'would upload' && test ! -f '$EP/distribute/youtube-uploads.json'"
node -e '
  const fs = require("fs");
  const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  c.show.slug = "example-show"; fs.writeFileSync(process.argv[2], JSON.stringify(c));
  c.show.slug = "test-show"; c.publishing.youtube.channel_id = ""; fs.writeFileSync(process.argv[3], JSON.stringify(c));
' "$T/config.json" "$T/placeholder.json" "$T/nochannel.json"
refuses "real upload refuses unedited example settings" "still has the example show" node "$D/upload-all-to-youtube.js" --episode-dir "$EP" --config "$T/placeholder.json"
check "empty channel ID warns that the guard is off" bash -c "node '$D/upload-all-to-youtube.js' --episode-dir '$EP' --config '$T/nochannel.json' --dry-run 2>&1 | grep 'channel guard is off'"
refuses "real upload with no OAuth client stops" "OAuth client file missing" node "$D/upload-all-to-youtube.js" --episode-dir "$EP"
refuses "episode upload needs its text files" "episode-title.txt missing" node "$D/upload-all-to-youtube.js" --episode-dir "$EP" --dry-run --episode-video "$EP/shorts/raw/clip-1.mp4"

# Channel guard, with a stand-in for youtube-upload.py that claims another channel.
GUARD="$T/guard"; mkdir -p "$GUARD/scripts"
cp "$D/lib.js" "$D/upload-all-to-youtube.js" "$GUARD/scripts/"
cat > "$GUARD/scripts/youtube-upload.py" <<'EOF'
import json
print(json.dumps({"video_id": "abc", "url": "https://www.youtube.com/shorts/abc", "title": "t", "privacy": "unlisted", "channel": "Other", "channel_id": "CHANNEL_WRONG"}))
EOF
touch "$T/no-such-client.json"
refuses "channel guard stops after the first wrong upload" "wrong channel" node "$GUARD/scripts/upload-all-to-youtube.js" --episode-dir "$EP" --python "$PY"
check "guard recorded exactly one upload" node -e '
  const u = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (Object.keys(u).length !== 1) throw new Error(Object.keys(u).join());
' "$EP/distribute/youtube-uploads.json"
rm -f "$EP/distribute/youtube-uploads.json" "$T/no-such-client.json"

check "build-linkedin-drafts.js runs without any account" node "$D/build-linkedin-drafts.js" --episode-dir "$EP" --start-date 2026-07-06
check "drafts follow the schedule and post rules" node -e '
  const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const assert = require("assert");
  assert.deepStrictEqual(d.map(x => x.clip), ["clip-2", "clip-1"]);
  assert.strictEqual(d[0].scheduled_at, "2026-07-06T13:00:00.000Z");
  assert.strictEqual(d[1].scheduled_at, "2026-07-09T13:00:00.000Z");
  assert.ok(d[0].media_path.endsWith("clip-2-final.mp4"));
  assert.ok(!/\p{Extended_Pictographic}/u.test(d[1].text), "emoji must be stripped");
  assert.ok(!/link in comments/i.test(d[1].text));
' "$EP/distribute/linkedin-drafts.json"
check "clock change holds the local time" node -e '
  const b = require(process.argv[1]);
  const assert = require("assert");
  assert.strictEqual(b.zonedToUtc("2026-07-06", "14:00", "Europe/London").toISOString(), "2026-07-06T13:00:00.000Z");
  assert.strictEqual(b.zonedToUtc("2026-11-09", "14:00", "Europe/London").toISOString(), "2026-11-09T14:00:00.000Z");
  assert.strictEqual(b.zonedToUtc("2026-11-09", "09:00", "America/New_York").toISOString(), "2026-11-09T14:00:00.000Z");
  assert.deepStrictEqual(b.generateSlots("2026-07-07", 2, ["Mon","Thu"], "14:00", "UTC").map(d => d.toISOString().slice(0,10)), ["2026-07-09","2026-07-13"]);
' "$D/build-linkedin-drafts.js"
check "paste pack is written" grep -q "Post 2:" "$EP/distribute/linkedin-paste-pack.md"

node -e '
  const fs = require("fs");
  const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  fs.writeFileSync(process.argv[2], JSON.stringify({ ...c, publishing: { ...c.publishing, linkedin: { ...c.publishing.linkedin, mode: "off" } } }));
  fs.writeFileSync(process.argv[3], JSON.stringify({ ...c, publishing: { ...c.publishing, linkedin: { ...c.publishing.linkedin, mode: "ghl" } } }));
  fs.writeFileSync(process.argv[4], JSON.stringify({ ...c, site: { ...c.site, enabled: true, repo: process.argv[5], episode_file: "{slug}.mdx" } }));
' "$T/config.json" "$T/off.json" "$T/ghl.json" "$T/site.json" "$T/site"
check "LinkedIn off skips cleanly" bash -c "node '$D/build-linkedin-drafts.js' --episode-dir '$EP' --config '$T/off.json' | grep 'nothing to do'"
check "GHL push is a no-op without GHL mode" bash -c "node '$D/push-linkedin-to-ghl.js' --episode-dir '$EP' | grep 'nothing to push'"
refuses "GHL push needs its token" "GHL_PRIVATE_TOKEN not found" env -u GHL_PRIVATE_TOKEN node "$D/push-linkedin-to-ghl.js" --episode-dir "$EP" --config "$T/ghl.json"
check "GHL dry run needs no token" bash -c "env -u GHL_PRIVATE_TOKEN node '$D/push-linkedin-to-ghl.js' --episode-dir '$EP' --config '$T/ghl.json' --dry-run | grep 'would push 2'"

check "site off skips cleanly" bash -c "node '$D/update-episode-page.js' --episode-dir '$EP' | grep 'nothing to do'"
mkdir -p "$T/site"
printf '%s\n' '# Page' '' '## Watch the Episode' '' 'embed' '' '## Full Transcript' '' 'words' > "$T/site/episode-2-tamsin-vell.mdx"
cat > "$EP/distribute/youtube-uploads.json" <<'EOF'
{ "clip-1": { "video_id": "AAA", "privacy": "unlisted" },
  "clip-2": { "video_id": "BBB", "privacy": "private", "publish_at": "2099-01-01T00:00:00Z" },
  "episode": { "video_id": "EEE", "url": "https://www.youtube.com/watch?v=EEE", "privacy": "unlisted" } }
EOF
check "site update patches the page and leaves out private clips" bash -c "node '$D/update-episode-page.js' --episode-dir '$EP' --config '$T/site.json' --write | grep '1 still private' && grep -q 'YouTubeShort id=\"AAA\"' '$T/site/episode-2-tamsin-vell.mdx' && ! grep -q BBB '$T/site/episode-2-tamsin-vell.mdx' && grep -q '## Full Transcript' '$T/site/episode-2-tamsin-vell.mdx'"
check "a second patch replaces, not repeats" bash -c "node '$D/update-episode-page.js' --episode-dir '$EP' --config '$T/site.json' --write >/dev/null && [ \$(grep -c '^## Highlights' '$T/site/episode-2-tamsin-vell.mdx') = 1 ] && grep -q '## Full Transcript' '$T/site/episode-2-tamsin-vell.mdx'"
check "with no site, posts link to YouTube" bash -c "node '$D/build-linkedin-drafts.js' --episode-dir '$EP' --start-date 2026-07-06 >/dev/null && grep -q 'watch?v=EEE' '$EP/distribute/linkedin-drafts.json'"

refuses "missing Google packages are explained" "Set up the venv" python3 -S "$D/youtube-upload.py" --help
if "$PY_YT" -c "import googleapiclient, google_auth_oauthlib" 2>/dev/null; then
  PY="$PY_YT"
  check "youtube-upload.py --help" "$PY" "$D/youtube-upload.py" --help
  check "youtube-manage.py --help" "$PY" "$D/youtube-manage.py" --help
  check "youtube-thumbnail.py --help" "$PY" "$D/youtube-thumbnail.py" --help
  refuses "upload with no token or client stops" "OAuth client file missing" "$PY" "$D/youtube-upload.py" --video "$EP/shorts/raw/clip-1.mp4" --title t --description d --credentials "$T/none.json" --token-store "$T/none-token.json"
  refuses "an empty --credentials is explained" "OAuth client file missing" "$PY" "$D/youtube-manage.py" --credentials "" --token-store "$T/none-token.json" privacy ABC private
  refuses "manage with no token or client stops" "OAuth client file missing" "$PY" "$D/youtube-manage.py" --credentials "$T/none.json" --token-store "$T/none-token.json" privacy ABC private
  refuses "thumbnail with a missing image stops" "Image not found" "$PY" "$D/youtube-thumbnail.py" --credentials "$T/none.json" --token-store "$T/none-token.json" ABC "$T/none.png"
  check "token save and reload keep owner-only permissions (Google mocked)" "$PY" - "$D" "$T/tok/token.json" <<'PYEOF'
import json, os, stat, sys
from pathlib import Path
from unittest import mock
sys.path.insert(0, sys.argv[1])
import youtube_auth
token = Path(sys.argv[2])
fake = mock.Mock(); fake.to_json.return_value = json.dumps({"refresh_token": "x", "client_id": "c", "client_secret": "s", "token": "t"})
flow = mock.Mock(); flow.run_local_server.return_value = fake
client = token.parent.parent / "client.json"; client.write_text("{}")
with mock.patch.object(youtube_auth.InstalledAppFlow, "from_client_secrets_file", return_value=flow):
    assert youtube_auth.get_credentials(client, token, ["scope"]) is fake
assert stat.S_IMODE(os.stat(token).st_mode) == 0o600
assert flow.run_local_server.call_args.kwargs["authorization_prompt_message"] == ""
PYEOF
else
  skip=$((skip+1)); echo "  skip: YouTube script tests (no Google packages: do the Python packages step in podcast/README.md)"
fi

echo ""
echo "passed: $pass  failed: $fail  skipped groups: $skip"
[ "$fail" -eq 0 ]
