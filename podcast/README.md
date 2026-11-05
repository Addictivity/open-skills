# Podcast pack

Nine Claude Code skills for producing a video interview podcast. Install steps are in the [root README](../README.md).

## Order of use

| # | Skill | What it does | Optional? |
|---|-------|--------------|-----------|
| 1 | `/podcast-edit` | Syncs three cameras and two mics, cuts retakes and dead air, builds speaker-led camera cuts, renders the master | Skip if you edit elsewhere |
| 2 | `/podcast-transcript` | Speaker-labelled transcript and chapters, plus word timings for cutting | Needed by most of what follows |
| 3 | `/youtube-description` | Five title options, a paste-ready description and tags | |
| 4 | `/podcast-episode-page` | Markdown page for your site, with schema fields | Skip if you have no site |
| 5 | `/thumbnail-brief` | Chooses the hook and guest frame, checks assets | |
| 6 | `/thumbnail-generate` | Renders the 1280x720 PNG | |
| 7 | `/shorts` | Picks clips, then renders 9:16 shorts with typography and karaoke captions | |
| 8 | `/distribute` | YouTube uploads with a channel guard, LinkedIn paste pack or GoHighLevel drafts, site highlights | LinkedIn and site steps are optional |
| 9 | `/podcast-guest-comms` | Guest review email and asset pack, as drafts | |

Nothing goes public until the guest approves, so the last three steps run in this order:

1. `/distribute` uploads the episode and clips unlisted and writes the LinkedIn paste pack. Don't schedule any posts yet.
2. `/podcast-guest-comms` drafts the review email, which you send.
3. Once the guest approves, flip the episode public, schedule the posts and send the asset pack.

Then archive the video with `archive-media.sh` from `/shorts`. Doing it earlier moves files that the steps above still need.

Start a skill with its slash command or by asking in plain words, such as "transcribe episode 3".

## Tools and keys per skill

| Skill | Tools | Keys and accounts | Paid? |
|-------|-------|-------------------|-------|
| `/podcast-edit` | **Palmier Pro (required for assembly)**, ffmpeg, Python 3 | None | Editor free, needs macOS 26 |
| `/podcast-transcript` | Python 3, ffmpeg, yt-dlp (for URLs) | `ASSEMBLYAI_API_KEY` | **AssemblyAI is paid per hour of audio** |
| `/youtube-description` | None | None | No |
| `/podcast-episode-page` | None | None | No |
| `/thumbnail-brief` | None | None | No |
| `/thumbnail-generate` | Python 3, Google Chrome, a background remover | None | Free on macOS. remove.bg and image MCP tools are paid |
| `/shorts` | HyperFrames (via `npx`), Node 22+, ffmpeg | None | No |
| `/distribute`: YouTube | Node, Python 3, ffmpeg | Your own Google OAuth client | Free within quota |
| `/distribute`: LinkedIn paste pack | Node | None | No |
| `/distribute`: GoHighLevel | Node | `GHL_PRIVATE_TOKEN`, `GHL_LOCATION_ID` | **GoHighLevel is a paid subscription** |
| `/distribute`: website | Node | None | No |
| `/podcast-guest-comms` | An email connector helps | None | No |

### Without Palmier

`/podcast-edit` drives Palmier Pro through its MCP server, and nothing else in the pack replaces that.

**Most people without Palmier should skip the skill.** Edit however you like and start at `/podcast-transcript` with your finished master. For `/shorts`, export the vertical clips from your editor as `shorts/raw/clip-N.mp4`.

**The cut-list scripts are a partial option.** `extract-rms.sh`, `diarize.py` and `build_edl.py` run without Palmier and give you a speaker-led camera cut list. You have to measure each camera's sync offset and choose the kept ranges yourself. The output is JSON that no editor imports, so an hour-long episode can mean hundreds of shots to place by hand.

## Setup

### Settings

Copy `config.example.json` to `~/.config/podcast-skills/config.json`. Replace everything in `show` and `publishing.youtube`, and add your `glossary`. Check that `paths` suits you. The other values work as they are, and you can ignore `site` while `enabled` is false. Real uploads refuse to run while `show.slug` is still `example-show`. Scripts look for `--config`, then `$PODCAST_CONFIG`, then that path.

| Block | Holds |
|-------|-------|
| `show` | Name, host, audience, publisher, hashtag |
| `voice` | Spelling and writing rules applied to everything written |
| `glossary` | Names speech-to-text gets wrong, corrected everywhere |
| `brand` | Colours and fonts, plus fixed thumbnail assets |
| `paths` | Episode folders, media archive, env file, OAuth client, tokens |
| `site` | Your site's URLs and page file, or `enabled: false` |
| `publishing` | YouTube channel and CTA block. LinkedIn mode and schedule |
| `transcription` | Model, language, cost per hour, cost cap |
| `guest_comms` | Asset pack folder and email sign-off |

`brand.colours` ships as a neutral set, so swap in your own:

| Colour | What it paints |
|--------|----------------|
| `thumbnail_background` | Thumbnail canvas |
| `thumbnail_strip` | Dark strips behind hook lines, and name boxes |
| `thumbnail_highlight` | The one highlighted hook line |
| `thumbnail_text` | Thumbnail text and name box borders |
| `short_accent` | The small line above the big word on a short |
| `short_main` | The big word on a short |
| `short_caption_future` | Captions not yet spoken |
| `short_caption_read` | Captions already spoken, and the active word |
| `short_caption_pill` | The pill behind the active word |

### Keys

API keys go in the file named by `paths.env_file`, or in your environment. Never in the settings file.

```bash
cat > ~/.config/podcast-skills/.env <<'EOF'
ASSEMBLYAI_API_KEY=your-assemblyai-key
# Only if publishing.linkedin.mode is "ghl":
GHL_PRIVATE_TOKEN=your-gohighlevel-private-integration-token
GHL_LOCATION_ID=your-gohighlevel-location-id
EOF
chmod 600 ~/.config/podcast-skills/.env
```

### Python packages

```bash
cd ~/.claude/skills/podcast-transcript && python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
cd ~/.claude/skills/distribute && python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
```

The other scripts use only the standard library.

### YouTube

Follow the setup section in `distribute/SKILL.md`: your own Google Cloud project, a Desktop OAuth client, and your channel ID in the settings file.

### Fonts

The pack bundles Sora, DM Sans and Gelasio, all under the SIL Open Font License, with the licence text beside each. To use your own, add it to `brand.font_files` and name it in `brand.fonts`. You need to hold the licence for any font you add, and if you publish a copy of this repo, leave proprietary fonts out.

### Check your setup

From the `open-skills` folder you cloned:

```bash
bash podcast/tests/run-offline.sh
```

Runs every script with no accounts or keys, using the two venvs from the step above. If you skipped those, the tests that need them are reported as skipped.

## The episode folder

Everything lives in `paths.episodes_root/Episode N - Guest Name/`. Skills read what earlier ones wrote. Raw footage and the master belong in `paths.media_archive`, which can be any folder and doesn't need to be an external drive. Short clips and renders stay in the episode folder until the last step above, so if the folder syncs, expect some large files for a while.

| File | Written by | Read by |
|------|------------|---------|
| `README.md` | You | Everything |
| `pre-call-brief.md` | You (optional) | Description, thumbnail, page |
| `transcript-clean.md`, `transcript-raw.txt`, `chapters.md`, `transcript-words.json` | `/podcast-transcript` | Most skills |
| `youtube-description.md` | `/youtube-description` | Thumbnail, page, distribute |
| `episode-page.md` | `/podcast-episode-page` | Your site, distribute |
| `thumbnail-brief.md`, `guest-cutout.png`, `thumbnail.png` | Thumbnail skills | Distribute, guest comms |
| `clips.md`, `shorts/` | `/shorts` | Distribute, guest comms |
| `distribute/` | `/distribute` | Guest comms |

### Episode README

Skills read this frontmatter, so keep the field names:

```markdown
---
title: Episode 2 - Tamsin Vell
episode: 2
guest: Tamsin Vell
guest_role: Founder
guest_company: Quillfen Coffee
guest_company_url: https://example.com
guest_linkedin: https://www.linkedin.com/in/example/
recorded: 2026-10-01
status: recorded
---

# Episode 2 - Tamsin Vell

## Links

YouTube: (added once uploaded)

## Guest requests

(anything the guest asked to cut or check)
```

Add a line under `## Links` or in `## Guest requests` whenever you learn something later skills should know. The YouTube line is filled in after `/distribute`.

### Pre-call brief (optional)

`pre-call-brief.md` is a short note you write before or after recording: the headline angle of the episode and the guest intro you read out. Later skills work better with it, because it tells them what the episode is about in your words.

### Show-level file (optional)

`content-lessons.md` in `paths.episodes_root` collects corrections from earlier episodes. Skills read it if it exists, and `/youtube-description` appends to it, so each episode starts with what you taught the last one.
