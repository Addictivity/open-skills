---
name: shorts
description: Pick and build branded 9:16 short-form clips for a podcast episode. Use when the user asks to "build the shorts for episode N", "render shorts for [guest]", "make the clips", "generate the LinkedIn clips", or anything about producing vertical shorts from an episode. Produces one clip per entry in clips.md (typically six to eight) in a fixed visual style: a coloured accent line tight against a huge lowercase serif word, karaoke captions with an active-word pill, and a fade to black. Renders with HyperFrames. Each clip uploads as-is to LinkedIn and YouTube Shorts.
version: 1.0.0
---

# /shorts

Repeatable pipeline for vertical clips. Takes raw vertical cuts and produces 1080x1920 clips, one per `clips.md` entry.

## Settings

Read the settings file first: `$PODCAST_CONFIG`, otherwise `~/.config/podcast-skills/config.json`. This skill uses `paths.episodes_root`, `paths.media_archive`, `brand.colours`, `brand.fonts`, `brand.font_files`, `glossary` and `transcription.whisper_model`.

## Tools

- **HyperFrames** (`npx hyperframes`, free and open source, Apache 2.0). Needs Node 22 or later and ffmpeg. First run downloads what it needs, including a Whisper model. The template also loads GSAP from a CDN, so rendering needs a network connection.
- **ffmpeg** for cutting and loudness.

## When to invoke

- "build the shorts for episode N" / "render shorts for [guest]"
- "make the clips" / "generate the LinkedIn clips for [guest]"
- A path to a `shorts/raw/` folder with video files

## The visual style

Colours and fonts come from the settings file. The layout is the design. Do not change it unless the user asks.

**Canvas:** 1080x1920 at 30fps, H.264 MP4.

**Typographic beat layer (mid-canvas, vertically centred):**

- Accent line: bold at 78px in `short_accent`, letter-spacing -1.5px.
- Main line: regular weight, huge, auto-fit from 620px down to 150px within 1010px width, in `short_main`, letter-spacing -6px, line-height 0.92.
- **The treatment that makes it work, on every beat of every short:**
  1. **Interlock, never a gap.** The accent and the main sit very close. The accent's baseline just touches, or sits a few px into, the main's actual glyph tops. Visible background between the lines is a failure. An accent buried past the tall letters is also a failure. The template measures real geometry in the browser to get this right at any size.
  2. **The main is all lowercase.** The only exception is all-caps acronyms (AI, CEO). Proper nouns belong in the accent. The scripts enforce this, but write the copy that way.
  3. **The main is 1 or 2 words, never 3,** as large as possible. The builder shifts excess words into the accent and warns. Fix the copy instead of relying on the shift.
  4. **No full stops render,** though question marks do.
  5. **Verbatim over paraphrase.** Beat words are what was said, quirks included. Numerals for spoken numbers are fine.
- Both lines have a motion-blur ghost to the right (translateX 18px, blur 10px, opacity 0.45).
- Each beat lives about 3.8s (0.9s in, hold, 0.9s out) and lands when the words are spoken. Three beats per clip, more for clips of 60s or longer.

**Framing and camera:**

- Subject offset to one side, with look room in the direction they face.
- **Cut straight to it.** A short has no warm-up. Trim the in-point to the first word of the question or line. If the source has silence before the opening line, keep about 0.5s as breathing room (check with `silencedetect`, because transcript end times overstate).
- **Never clip the speaker mid-sentence at the out.** Read the transcript past the planned out-point and extend to the end of the thought. Cut in the gap after the final word. A short spoken button from the host right after the guest's last line makes a strong ending, so include it on their camera when it exists.
- **Go back and forth.** Start from the master edit's camera map, then add brief 1.5 to 2.5s host reaction cuts so no shot runs much beyond 15s. Place them at audible interjections or sentence boundaries. A host cut across an audio splice also hides the guest's jump cut.

**Karaoke captions (lower third):** 60px regular weight, three states per word: future (`short_caption_future`), active (`short_caption_read` on a `short_caption_pill` rounded pill), read (`short_caption_read`, no pill). Words group into chunks of at most 4, breaking on punctuation.

**Fade to black:** the final 0.6s of every clip.

**Fonts:** DM Sans and Gelasio ship in `template/fonts/` under the SIL Open Font License. Gelasio is metric-compatible with Georgia. To use your own, add it to `brand.font_files` and set `brand.fonts`.

The template is `template/index.html`. Treat it as the source of truth: the scripts substitute values into it, so do not redesign it per clip.

## Workflow

### 1. Resolve the episode folder

`paths.episodes_root/Episode N - Guest Name`. If ambiguous, ask.

### 2. Pick the clips (skip if `clips.md` exists)

Read `transcript-clean.md` and the brief's headline angle, then choose six to eight moments of 25 to 75 seconds that stand alone without the episode. Look for a clear claim or a story with a turn. Write `clips.md` in the format in `references/clips-format.md`, including a posting order with the clip that matches the title first. Get the user's sign-off on the list before cutting.

Take cut windows from `transcript-words.json`. Word times from the full-episode transcript can drift by about a second, and per-clip Whisper transcripts are only for the karaoke layer.

### 3. Cut the raw verticals (skip if the user exported them from their editor)

Save to `shorts/raw/clip-N.mp4`. Cut from the source cameras using the offsets handed over by `/podcast-edit`, and take audio from the master. For one continuous shot from a 1080p camera:

```bash
# master_t is a time in the finished master. Cuts moved everything after them, so first find
# the kept segment it falls in, in final_build.json: uncut_t = (trimStartFrame + master_frame - startFrame) / fps
# source_t = uncut_t - (camera_offset_frames / fps)
mkdir -p shorts/raw
ffmpeg -ss <source_t> -t <length> -i camera.mp4 -ss <master_t> -t <length> -i master.mp4 \
  -map 0:v -map 1:a -vf "crop=608:1080:<x>:0,scale=1080:1920:flags=lanczos,unsharp" \
  -c:v libx264 -crf 16 -c:a aac -b:a 256k shorts/raw/clip-N.mp4
```

Move `<x>` to set the look room. For back-and-forth cuts, cut each shot this way and join them with ffmpeg's concat demuxer. Keep the master audio continuous underneath.

### 4. Normalise audio

Target -14 LUFS.

```bash
bash ~/.claude/skills/shorts/scripts/normalise-audio.sh "<episode>/shorts/raw"
mv "<episode>/shorts/raw/normalised/"* "<episode>/shorts/raw/" && rmdir "<episode>/shorts/raw/normalised"
```

**Do the `mv`.** `build-compositions.js` copies from `raw/`, so skipping it ships un-normalised audio with no error.

### 5. Transcribe each clip

Word-level timings drive the karaoke layer.

```bash
bash ~/.claude/skills/shorts/scripts/transcribe-clips.sh "<episode>/shorts"
```

The script uses `small.en` unless you set `WHISPER_MODEL`, so pass `transcription.whisper_model` from the settings file that way if it differs. Writes `shorts/transcripts/<clip>.json`, an array of `{ text, start, end }`. The builder applies single-word `glossary` fixes. Fix multi-word errors by hand in the JSON.

### 6. Check the beats in `clips.md`

See `references/clips-format.md`. Each beat's `@anchor` must be a word the transcript heard, used once in the clip, at least 1s after the previous anchor. The builder warns on any miss. Do not render with anchor warnings.

### 7. Generate compositions

```bash
node ~/.claude/skills/shorts/scripts/build-compositions.js --episode-dir "<episode>"
```

Writes `shorts/composition-N/index.html` for each clip. **Re-cut a raw clip? Delete its `composition-N/` folder first,** because an existing `clip.mov` is kept and would render stale footage.

### 8. Render

`render-all.sh` lints each composition, then renders it. Sequential, to avoid CPU contention. Long clips can take many minutes.

```bash
bash ~/.claude/skills/shorts/scripts/render-all.sh "<episode>/shorts"
```

Each clip writes `shorts/renders/clip-N-final.mp4`.

### 9. Check a frame from each beat

Extract one frame at each beat's mid-point and view it. Common failures:

- Beat invisible at the expected time: check `.beat` still has `position: absolute`.
- Gap between accent and main, or accent buried: the interlock measurement failed. Verify on a large x-height main ("over"), a small long main ("wholesale pricing") and a caps main ("VAT = ROI"). Static HTML in a browser will mislead you here, because the fit function only exists in the renderer.
- Capitals in the main that are not an acronym: the lowercase enforcement failed.
- Main longer than 2 words: fix the copy in `clips.md` and rebuild.

Pass each MP4 path to the user with a short summary. They watch for motion sync.

### 10. Archive the media, last of all

Do this only after `/distribute` and `/podcast-guest-comms` have finished. Both read the rendered MP4s from the episode folder, and they fail if the files have moved. Heavy video should not stay in a synced folder for good.

```bash
bash ~/.claude/skills/shorts/scripts/archive-media.sh "<episode>" "<paths.media_archive>/Episode N - Guest"
```

## Scripts

- `scripts/normalise-audio.sh`: -14 LUFS copies of every raw clip.
- `scripts/transcribe-clips.sh`: Whisper word timings per clip.
- `scripts/build-compositions.js`: fills the template per clip.
- `scripts/render-all.sh`: lint and render.
- `scripts/archive-media.sh`: moves video to the archive after sign-off.

## Next

`/distribute` takes the rendered MP4s to YouTube and LinkedIn. Come back for step 10 at the end.
