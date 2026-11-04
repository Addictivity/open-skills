---
name: podcast-transcript
description: Transcribe a podcast episode with AssemblyAI. Use when the user asks to transcribe an episode, get the transcript for a YouTube URL or a local master, or says "transcribe episode N", "transcribe [guest]" or "transcribe this". Produces a clean speaker-labelled transcript, a raw transcript, a chapter list and word-level timings in the episode folder.
version: 1.0.0
---

# /podcast-transcript

Transcribes an episode with AssemblyAI (speech model plus speaker labels and timed section summaries). Writes four files into the episode folder.

## Settings

Read the settings file first: `$PODCAST_CONFIG`, otherwise `~/.config/podcast-skills/config.json`. If neither exists, stop and ask the user to copy `config.example.json` there.

This skill uses `show.host`, `show.slug`, `paths.episodes_root`, `paths.env_file` and the `transcription` block. It needs `ASSEMBLYAI_API_KEY`.

## When to invoke

- "transcribe episode 2" / "transcribe [guest]" / "transcribe the next episode"
- "get the transcript for [YouTube URL]"
- A YouTube URL or a master file with "transcribe this"

## Workflow

### 1. Resolve the episode folder

Episode folders live under `paths.episodes_root` as `Episode N - Guest Name`.

- Episode number: look for `Episode N - *`.
- Guest name: look for `Episode * - Name*`.
- YouTube URL: search each episode README for that URL.
- Still ambiguous: ask.

### 2. Read episode metadata

From the episode `README.md`, take `episode:` and `guest:` from the frontmatter, plus the YouTube URL if there is one.

### 3. Confirm before billing

Tell the user the episode, the source (URL or file), the files that will be written and the cost estimate (`--dry-run` prints it). Wait for confirmation unless they have already said to go.

### 4. Run the script

Normal case: post-production runs before YouTube, so there is no URL yet. Extract a small mono audio file from the master and pass that. Transcript timing then equals master timing, which `/shorts` relies on.

```bash
ffmpeg -i "<master>.mp4" -vn -c:a aac -b:a 128k -ac 1 /tmp/episode-audio.m4a

~/.claude/skills/podcast-transcript/.venv/bin/python \
  ~/.claude/skills/podcast-transcript/scripts/transcribe.py \
  --input-file /tmp/episode-audio.m4a \
  --output-dir "<episode-folder>" \
  --guest-name "Guest Name" \
  --episode N
```

If the episode is already on YouTube, swap `--input-file` for `--url "<url>"`.

Add `--force` only after the user confirms overwriting existing transcripts.

**Master changed after transcription?** If a re-cut only removes or shifts ranges and the body is frame-identical, do not re-run. Shift every timestamp after the cut by the exact delta in `transcript-clean.md`, `chapters.md`, `youtube-description.md` and `episode-page.md`. Delete the cut sentences from the transcript text. Note in the README that `transcript-words.json` still carries the old timings. A shift is exact; a re-run costs money and produces different wording to re-review.

### 5. Verify outputs

Check the four files exist: `transcript-raw.txt`, `transcript-clean.md`, `chapters.md`, `transcript-words.json`. If any are missing, report the script's stderr.

### 6. Update the episode README

Mark the transcript as done and update `status:` if the README tracks one.

### 7. Report back

Give the duration, word count, speaker count, chapter count and cost estimate from the script's output. Warn if it detected three or more speakers, because the labels need a manual check.

## Conventions

- The first voice heard is labelled as the host. This holds when the host opens the episode. If a cold open starts with the guest, swap the labels by hand.
- Files are not overwritten by default: the script exits with an error if outputs exist.
- Apply `glossary` from the settings file to `transcript-clean.md` after the run, because speech-to-text gets names wrong.
- Keep API keys out of the skill folder. Use `paths.env_file` or the environment.

## Outputs

See `references/output-formats.md` for examples.

| File | Purpose |
|------|---------|
| `transcript-raw.txt` | Plain text, for archive. |
| `transcript-clean.md` | Speaker-labelled and timestamped. Feeds `/youtube-description` and `/podcast-episode-page`. |
| `chapters.md` | YouTube timestamps plus section summaries. Feeds `/youtube-description`. |
| `transcript-words.json` | Word timings in milliseconds. `/shorts` uses these to pick cut points. |

## Costs

The settings file holds `cost_per_hour_usd` (default 0.20). That is the sum of AssemblyAI's list prices for Universal-2, standard diarization and summarization when this was written. Check https://www.assemblyai.com/pricing and update the setting, because the script's estimate only knows what you tell it.

## Failure modes

- **yt-dlp fails on a private video** (unlisted is fine). Download it by hand and pass `--input-file`.
- **Cost cap** (`cost_cap_usd`) stops accidental runs on multi-hour files. Override with `--cost-cap-usd`.
- **AssemblyAI errors** come through from the API response, usually a rate limit or invalid audio.
- **No chapters returned:** `chapters.md` says so. Write them by hand from the transcript.
- **API key missing:** the script exits and says where to put it.

## Next

`/youtube-description` consumes `transcript-clean.md` and `chapters.md`.
