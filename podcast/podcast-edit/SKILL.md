---
name: podcast-edit
description: Build the full multi-camera, dual-mic master edit for a podcast episode in the Palmier Pro video editor, driven end to end through its MCP server. Use when the user asks to "edit episode N", "build the multicam edit for [guest]", "do the Palmier edit", "assemble the master" or anything about turning raw studio footage (three cameras plus two lav mics) into the edited episode. Syncs all sources, cuts retakes and dead air, builds a speaker-led camera map from mic energy, assembles it with no ripple and no undo, renders the 1080p master and hands the segment map and camera offsets to /shorts.
version: 1.0.0
---

# /podcast-edit

Repeatable multicam edit through the **Palmier Pro** MCP video editor. Takes one take from three cameras and two lav mics and produces the edited master: synced, retakes and dead air removed, speaker-led camera cutting with wide accents, a clean intro.

The segment map and camera offsets get reused by `/shorts`, so one edit produces two output formats.

## Settings

Read the settings file first: `$PODCAST_CONFIG`, otherwise `~/.config/podcast-skills/config.json`. This skill uses `paths.episodes_root` and `paths.media_archive`.

## Palmier is required for the assembly

Palmier Pro (https://palmier.io) is a macOS editor with a local MCP server. Its site lists macOS 26 as the minimum, and says the editor and MCP connection are free while generation credits are paid. This skill uses no generation features.

The server runs only while the app is open with a project loaded, on a port that changes per launch (`http://127.0.0.1:<PORT>/mcp`). Grab the current connection command from the app's connect screen, register it as `palmier`, then **restart the Claude Code session** so the tools load. If the tools are missing, say so and stop.

**Without Palmier:** `extract-rms.sh`, `diarize.py` and `build_edl.py` all run on their own. You still get frame-accurate kept ranges and a speaker-led camera cut list as JSON, and you place those clips by hand in your own editor. Phases 0, 2 and 3 carry over. The Palmier rules below do not.

## When to invoke

- "edit episode N" / "build the multicam edit for [guest]"
- "do the Palmier edit for [episode]" / "assemble the master for [guest]"

## What it produces

- `EP{N}-synced-multicam-master.palmier`: synced project snapshot (all five sources, nothing cut).
- `EP{N}-multicam-v{1,2}.mp4`: full master renders for review.
- `EP{N}-multicam-v{final}.palmier` plus a `Build Scripts/` folder, backed up to `paths.media_archive`.
- A handoff block for `/shorts`: kept-segment EDL, per-camera source offsets, fps.

## Source pattern

- **Two lav mic WAVs** from one recorder (two tracks, identical length, one shared sync offset). Track order is not guaranteed: confirm which is the host from a passage where only the host talks.
- **Three cameras:** host close, guest close, wide two-shot. Usually 25fps 1080p.
- Mics often start well after the cameras, because the cameras catch the audio setup. Not always: they can also start minutes before. If the mic offset is negative, place the mics at frame 0 with `source: [offset_s, end]` and give `build_edl.py` a negative `host_mic` and `guest_mic` offset. The maths holds. A cheap, frame-accurate way to get the offset: 1ms RMS-envelope cross-correlation of the mic mix against the wide camera's scratch audio over three or four 60s windows (numpy). They should agree within a frame. If they do not, investigate.

## The Palmier rules (each one learned the hard way)

0. **The finished episode is a Palmier project.** Every change to the main episode, including late fixes (outro pad, fade to black, a missed frame, a retake trim), is made inside the project and re-rendered from it, so the `.palmier` backup always matches the shipped master. Never patch the master with ffmpeg: that route leaves the project a version behind the render. If Palmier is not running, ask the user to open it and re-register the MCP port. ffmpeg stays for analysis, checks, review excerpts and the shorts.
1. **Set the project fps to the camera fps before assembling.** Palmier defaults to 30. Wrong fps means judder.
2. **`ripple_delete_ranges` and `remove_words` do not work on a synced multicam stack.** Tracks are sync-locked. A ripple cuts only the anchor and its linked scratch, desyncs the rest, then jams ("no room"). Never structurally cut by ripple. **The one safe ripple: a range that is empty on every track.** Remove the clips you are replacing on all tracks first, then `ripple_delete_ranges` (trackIndex of any track, units frames) on the empty range. Every sync-locked track shifts left together with mutes and trims intact. Palmier drops a track that becomes empty, so re-read indices after the removal.
3. **`undo` cascades and can wipe the whole timeline.** An earlier non-assistant "Import Media" step blocks a clean single step back. Never rely on `undo` for multi-step rollback. Snapshot with `export_project mode:palmier` before risky edits and record where every clip sits. Media IDs persist, so you can rebuild.
4. **Build the edit as an EDL via `add_clips`:** compute kept segments and place them by `startFrame`, `trimStartFrame` and `durationFrames`. `add_clips` takes `source: [startSeconds, endSeconds]`, not frames, and it floors both the trim and the duration. Pad every source end by +0.02s, check `trimStartFrame` on the first clip of each track in the response, and fix with `set_clip_properties`. `insert_clips` is the one primitive that does ripple sync-locked tracks together, if you ever need it.
5. **No range export.** `export_project` renders the whole timeline. For a short check-render, temporarily shrink the tail via `set_clip_properties durationFrames`, render, then set it back.
6. **Add cameras one video clip at a time.** Adding several in one call collides their linked scratch audio onto one track. Sequential, non-overlapping overlay clips are fine to batch.
7. **Any modal dialog silently wedges Palmier** (a macOS file-access prompt on an external volume, an update prompt). Symptoms: 0% CPU, tool calls hang, an import or export makes no progress, no error. A wedged export holds a lock that blocks all further exports until an app restart, which changes the MCP port. Before a long import or render, dismiss every dialog and decline any update. If a render stalls, check for a dialog first.
8. **Render to the internal disk, then move the file.** Rendering straight to an external SSD has hung at moov finalisation (2.5GB written, then 0% CPU, no valid file). Internal render is fast and reliable. Copy it after.

## Workflow

Resolve the episode folder first: `paths.episodes_root/Episode N - Guest Name/`. Raw media lives under `paths.media_archive/Episode N - Guest Name/Source Files/`.

### Phase 0: guest requests, asset check, import

- **Check the guest's messages for edit requests before cutting anything.** Search the user's email (and ask about any other channel) for mail from the guest since the recording date: anything to remove (off-limits topics, a name, a number), retakes to keep or drop, a title or thumbnail sensitivity, an approval condition. Log what you find, or "no requests", in the episode README under `## Guest requests`. Apply them in the content pass and re-check before upload.
- Import all five sources. Verify each camera reads (`ffprobe` or `inspect_media`). A full-size MP4 with **no `moov` atom** is a truncated recording that never finalised, and the last clip on a card is the usual victim. Recovery: re-download the finalised files from wherever they were shared. Pull per-file links (resumable), never a folder zip (usually not resumable). Download one at a time to the internal disk, verify with `ffprobe`, then replace the broken originals. `untrunc` against a healthy same-camera file is a fallback, though truncated files can also be missing tail frames.
- Confirm both mic tracks have audio. Palmier's `hasAudio:false` on WAVs is a known false flag. Identify host and guest mic from the intro monologue.
- Set the project to 1920x1080 at camera fps.
- **LED colour-pulse check.** Measure 12s of each camera's background (top strip, `crop=1920:300:0:0`, `signalstats` UAVG/VAVG at 4 fps). A repeating sawtooth in U/V with flat Y means an RGB wall light is running a colour-fade loop. Viewers read it as the grade flipping between two looks on every cut. Nothing in the edit causes or fixes it: log it in the README, tell the user before the cut, and set the light to a static colour for the next recording.

### Phase 1: sync and snapshot

- Lay each camera on its own video track (one clip per call). `sync_audio` cross-correlates cameras well. Move the video and the linked scratch follows.
- **Close lav mics will not cross-correlate** with roomy camera scratch, so `sync_audio` refuses them. Align by transcript landmark: pick one sharp shared word, get `inspect_media` wordTimestamps on a mic and a camera, compute the source-frame offset, place the mic clip. Verify against the same word across all sources (target under half a frame).
- **Mute all camera scratch audio** (`set_clip_properties volume 0`, keep for reference). The two clean mics carry the sound.
- **Identify host cam and guest cam by who is talking, never by appearance.** At a moment only the host speaks, inspect both close cams: the host cam is the one whose subject's mouth is moving. Cross-check against the diarisation. Camera numbering can flip between episodes, so re-verify every time. The `host_cam` and `guest_cam` refs depend on this.
- Record every offset. These are the master (M-space) placement frames.
- `export_project mode:palmier` to `EP{N}-synced-multicam-master.palmier`. Render a wide two-shot check clip of about 40s and get sign-off on sync before cutting.

### Phase 2: intro cut

- Parse the opening transcript (`get_transcript`) into a retake map. Cut the mic check and any aborted retakes. Splice the clean takes and confirm the join reads clean. Render a check of the intro.
- **Cover every intro splice with a camera change, not a punch-in.** Host cam for the opening, cut to the wide two-shot so the splice lands on the camera change, back to the host cam on a sentence boundary, wide again for the welcome so it flows into the body's wide base. Zoom 1.0 throughout, because punch-ins read as harsh jumps. Camera clips go in with `includeAudio=false`.
- **Measure cut points with `silencedetect` on the mic or master, not transcript word times.** Word end times can overstate by 0.3 to 1.0s. Leave about 0.3s of room tone each side of an audio splice, and check the RMS trace for clicks or breaths in the kept air. Keep the intro punchy, under a minute.
- Render a 720p excerpt of the first 60s for review (ffmpeg from the master render), not a full check-render.

### Phase 3: speaker map

- Export per-0.1s RMS of both lav mics: `scripts/extract-rms.sh <host.wav> <guest.wav> <workdir>`.
- `scripts/diarize.py <host_rms.txt> <guest_rms.txt>` gives the talk-time split and turns. Sanity check: guest talk time well above host for an interview.
- **Listen where the transcript goes quiet but the mic does not.** Speakers say "edit that out" under their breath, and transcription engines can render it as a pause or an ellipsis. Before assembling, list every span of 1.5s or more where the diarisation shows speech but the transcript has no words (or only "..."), and check each one: transcribe it with a second engine, or view the RMS. Cut anything aimed at the producer on sight.
- Run a content pass over the clean transcript for the dead-air gaps and the fluff and retake list. Energy alone cannot judge filler, false starts, repeats or off-topic tangents. Keep one or two charming asides.

### Phase 4: assemble the EDL

- Fill an episode config (see `references/episode-edit.example.json`): fps, per-media `refs` and `offsets` from Phase 1, the `kept_M` ranges, the two RMS paths.
- `scripts/build_edl.py <config.json>` writes `final_build.json`: `add_clips` payloads for the base (wide radio-edit, host mic, guest mic, identical cuts) and the camera overlay (speaker-led shots with wide accents: questions go wide, an establishing wide open, and a recurring two-shot through long runs).
- **Two-shot use and no flash cuts:** the builder recurs a wide of about 2.5s (`breath_s`) every `wide_every_s` (default 16s) inside any single-speaker run, and enforces a minimum on every cut (`min_shot_s` 1.6s, `min_wide_s` 1.4s). Lower `wide_every_s` means more wide.
- The **intro is a special case**, built separately (Phase 2), not through `build_edl.py`. Build the body with body-only `kept_M`, then place it on the timeline at +`intro_frames`. Base and overlay stay continuous when the intro ends and the body begins at the same host-mic source second.
- Execute in Palmier: place the three base tracks, then paint the overlay onto a top video track with `add_clips`. Every placed camera clip spawns a linked scratch audio clip. Collect all their IDs from the responses and `set_clip_properties volume 0` in one batch so only the mics sound.
- **Check the overlay reaches the final body frame.** The script extends a thin tail, but confirm `overlay[-1].startFrame + durationFrames == total` after any manual change. A gap renders as a flash of the bare wide track at the very end.

### Phase 5: review rounds

- Check-render with the tail-shrink trick (rule 5), sampling frames end to end to confirm cameras and joins.
- Apply notes on a copy of the edit timeline (`create_timeline from=`) so the shipped version stays intact. If the runtime changes after transcription, shift timings by the exact delta (see `/podcast-transcript`) instead of re-running. If it changes after upload, YouTube needs a new upload (see `/distribute`, re-upload recipe).

### Phase 6: master render, backup, handoff

- **End the edit properly.** Never let the last kept range stop on the outro's final word boundary. Pad at least 1s past the last word (verify with `silencedetect` on the host mic), then fade to black over the final 1.5s, picture and sound. In Palmier: extend the last camera overlay clip and both mic clips with `set_clip_properties durationFrames`, then set `fadeOutFrames` on the overlay clip and both mic clip IDs (fades do not propagate to linked media). Make sure the wide base ends before the fade so nothing shows through.
- Render the full master at 1080p to the internal disk, then copy it to `paths.media_archive` as `EP{N}-multicam-v{final}.mp4` (rule 8). Masters run to gigabytes, so cut short 720p excerpts for review.
- Back up the `.palmier` project and `Build Scripts/` (config and `final_build.json`).
- Hand `/shorts` the kept-segment EDL and the per-camera source offsets, with the fps. Shorts are cut from the source cameras using this timing maths, not from the master.

## Scripts

- `scripts/extract-rms.sh <host.wav> <guest.wav> <out_dir> [window_s=0.1] [rate=48000]`: per-window mic loudness via ffmpeg.
- `scripts/diarize.py`: energy diarisation, talk-time split (validation gate).
- `scripts/build_edl.py <config.json>`: the `add_clips` EDL (base tracks and camera overlay). Thresholds live in the config's `shot` block.

## Next

`/podcast-transcript` on the rendered master, then `/shorts`.
