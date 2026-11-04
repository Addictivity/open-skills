---
name: distribute
description: Distribute a podcast episode and its shorts. Use when the user asks to "distribute the shorts for episode N", "upload the shorts to YouTube", "schedule the LinkedIn posts for [guest]", "launch the promotion campaign" or anything about getting rendered video out to platforms. Assumes /shorts has produced the MP4s. YouTube upload uses your own Google OAuth. LinkedIn (a paste pack, or optional GoHighLevel drafts) and the website update are optional steps you can turn off in settings.
version: 1.0.0
---

# /distribute

Takes the rendered MP4s from `/shorts` and the master from `/podcast-edit`, and gets them onto YouTube, with optional LinkedIn and website steps.

## Settings

Read the settings file first: `$PODCAST_CONFIG`, otherwise `~/.config/podcast-skills/config.json`. This skill uses `show`, `paths`, `site` and `publishing`.

| Setting | What it controls |
|---------|------------------|
| `publishing.youtube.channel_id` | The channel guard. Set it, see below. |
| `publishing.youtube.privacy` | Default `unlisted`: you toggle to public after review. |
| `publishing.linkedin.mode` | `paste-pack` (default, no account needed), `ghl` or `off`. |
| `publishing.linkedin.post_days`, `post_time`, `timezone` | The cadence. Default Monday and Thursday at 14:00, one clip per slot, no re-posts. |
| `site.enabled` | Turns the website step on. |

## When to invoke

- "distribute the shorts for episode N" / "upload the shorts to YouTube"
- "schedule the LinkedIn posts for [guest]"
- "launch the promotion campaign"

## The guest-approval gate

**Nothing public until the guest approves the unlisted episode.** Unlisted or scheduled video and draft posts are fine. The public website is not: leave the episode page and any shorts row unpublished until the guest replies. The review email (`/podcast-guest-comms`) goes out first, and the launch waits for the answer.

Check titles for guest sensitivity before upload as well: provocative about the topic, always positive about the guest. Retitling after a guest objects is a worse conversation than checking first.

## Setup (once)

1. **Python packages:**
   ```bash
   cd ~/.claude/skills/distribute && python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
   ```
2. **Your own Google OAuth client.** In Google Cloud Console: create a project, enable YouTube Data API v3, configure the OAuth consent screen, add your Google account as a test user, create an OAuth client of type Desktop app, and download the JSON to `paths.google_client_secret`. Keep it outside any repo.
3. **Find your channel ID** in YouTube Studio under Settings, Channel, Advanced settings, and put it in `publishing.youtube.channel_id`.

**Quota.** The YouTube Data API gives a new project a limited daily quota, and each upload costs a large share of it. Check the current numbers in the Google Cloud console before a big batch. A batch that hits the limit can resume the next day, because uploaded clips are skipped.

Tokens are saved to `paths.tokens_dir` with owner-only permissions. Never put them in a repo.

## Workflow

### 0. Pre-reqs

- One MP4 per clip at `<episode>/shorts/renders/clip-N-final.mp4`
- `<episode>/clips.md` with captions and a posting order (see `/shorts`)
- `<episode>/youtube-description.md`
- The master render, if you are uploading the episode now

### 1. Fix the audio on the renders (if needed)

Editors often export a mono mic on the left channel only. Check with `ffprobe` or by ear, and fix before anything goes out:

```bash
bash ~/.claude/skills/distribute/scripts/fix-audio-stereo.sh "<episode>/shorts/renders"
```

### 2. Generate YouTube metadata

```bash
node ~/.claude/skills/distribute/scripts/build-youtube-metadata.js --episode-dir "<episode>"
```

Writes `distribute/youtube-metadata.json`: LinkedIn hooks become titles, captions become descriptions, and tags come from your settings and the episode.

### 3. Upload

For the full episode, first save each chosen field from `youtube-description.md` to its own file in `distribute/`: `episode-title.txt`, `episode-description.txt`, `episode-tags.txt`. Then:

```bash
node ~/.claude/skills/distribute/scripts/upload-all-to-youtube.js \
  --episode-dir "<episode>" --episode-video "<master>.mp4" --dry-run
```

Check the plan, then run it again without `--dry-run`. Clips upload first and the episode last. Leave out `--episode-video` for clips only.

First run opens a browser for OAuth consent. Output goes to `distribute/youtube-uploads.json`, and anything already recorded there gets skipped. To force a re-upload, delete the entry.

**Channel guard.** YouTube uploads go to whichever channel you picked in the consent screen, and accounts that manage several channels make that easy to get wrong. The chooser's names and avatars can be stale, so only the channel ID proves it. With `channel_id` set, the script stops after the first upload that lands anywhere else. Since clips go first, a wrong pick costs one small clip instead of a multi-gigabyte episode. The upload scope has no delete permission, so delete the stray video in YouTube Studio, delete the token file and run again.

**Brand Account channels.** To upload to a secondary channel: delete the saved token, switch to that channel in YouTube Studio, then run the upload and choose it in the consent screen.

**Testing-mode tokens die after 7 days.** An OAuth app left in Testing mode loses its refresh token after a week, so a launch more than a week after the last one needs a fresh browser consent. The scripts handle it by opening the browser again.

### 4. Set the thumbnail and manage privacy

`youtube-manage.py` and `youtube-thumbnail.py` need a broader scope than upload, so they share a separate token file and ask for their own consent.

```bash
PY=~/.claude/skills/distribute/.venv/bin/python
S=~/.claude/skills/distribute/scripts
# CREDS is paths.google_client_secret, MANAGE is paths.tokens_dir + /youtube-manage-token.json

$PY $S/youtube-thumbnail.py --credentials "$CREDS" --token-store "$MANAGE" <VIDEO_ID> "<episode>/thumbnail.png"
$PY $S/youtube-manage.py --credentials "$CREDS" --token-store "$MANAGE" schedule <VIDEO_ID> 2026-07-09T13:00:00Z
$PY $S/youtube-manage.py --credentials "$CREDS" --token-store "$MANAGE" unschedule <VIDEO_ID>
$PY $S/youtube-manage.py --credentials "$CREDS" --token-store "$MANAGE" privacy <VIDEO_ID> public
```

Only flip the episode public once the guest has approved.

### 5. LinkedIn (optional)

Skip this step with `publishing.linkedin.mode: "off"`.

```bash
node ~/.claude/skills/distribute/scripts/build-linkedin-drafts.js --episode-dir "<episode>" [--start-date YYYY-MM-DD]
```

Run it after rendering, because it records the media path at build time. It writes `distribute/linkedin-drafts.json` and `distribute/linkedin-paste-pack.md`: per post, the slot, the file, who to tag, and the caption in a code block.

Post rules built into the script: no emoji, and one link only, to the episode page if you have one, otherwise YouTube.

**Paste pack (default, no account needed).** Schedule the posts natively in LinkedIn from the pack. This is the better route if you tag people: API scheduling tools often cannot @mention reliably, and a guest post should tag the guest and their company. LinkedIn's collaborator feature is worth a test on the first post.

**GoHighLevel (optional).** If you already use GoHighLevel, set `mode` to `ghl`, add `GHL_PRIVATE_TOKEN` and `GHL_LOCATION_ID` to your env file, and:

```bash
node ~/.claude/skills/distribute/scripts/push-linkedin-to-ghl.js --episode-dir "<episode>" --dry-run
node ~/.claude/skills/distribute/scripts/push-linkedin-to-ghl.js --episode-dir "<episode>" --status draft
```

Set `account_name_match` if the location has several LinkedIn accounts. Each post needs both the account ID and its `oauthId` as `userId`, which the script handles. The create response sometimes comes back without a clear ID, so confirm in Social Planner. Drafts wait for your approval there.

### 6. Website (optional)

Skip this step with `site.enabled: false`, and remember the guest-approval gate.

```bash
node ~/.claude/skills/distribute/scripts/update-episode-page.js --episode-dir "<episode>"
```

Writes `distribute/highlights.json` (`id` and `title` per clip). Use that in your site's code, or add `--write` to patch the markdown or MDX file at `site.repo` + `site.episode_file` with a Highlights section using the `site.short_embed` snippet. The script never commits or pushes. Review the diff yourself.

**Only list clips that are already visible.** The script leaves out private ones. A scheduled Short is private until it publishes and has no thumbnail at any size, so it renders as a dead grey tile.

**Thumbnails on fresh uploads.** If your site builds thumbnail URLs from `img.youtube.com/vi/<id>/`, `oardefault.jpg` (the 9:16 version) can return 404 for hours to days after upload. Fall back to `hqdefault.jpg`, then `frame0.jpg`. It sorts itself out. If it is still broken after 48 hours, suspect your component.

### 7. Finish

- Delete any test uploads from YouTube Studio.
- Toggle videos to public once the guest has approved, ideally before the first scheduled post goes out.
- Approve the posts, or schedule them from the paste pack.

## Re-upload recipe

YouTube cannot replace a video file, so if the master changes after upload:

1. Upload the new master unlisted with the same metadata.
2. Set the thumbnail on the new video.
3. Set the old video private (`youtube-manage.py privacy <id> private`). The tokens have no delete scope, so delete it by hand in Studio.
4. Record the old entry as `episode_superseded` in `youtube-uploads.json`, and put the new one under `episode`.
5. Swap the ID everywhere it appears: site data, `episode-page.md`, `clips.md`, the README, any guest draft.

Shorts are cut from the source cameras, so they are untouched.

## YouTube API quirks the scripts handle

- A status update that omits `embeddable` resets the video to not-embeddable, so site embeds stop working. `youtube-manage.py` always sends it.
- `publishAt` cannot be nulled directly. Cancelling a schedule means bouncing through unlisted, which `unschedule` does.
- The consent prompt prints to stdout by default, which would corrupt captured JSON. It is suppressed.

## More than one machine

The `.venv`, OAuth client and tokens do not sync between machines. Rebuild or copy them per machine, and keep them out of synced notes folders.

## Scripts

| Script | Needs | Purpose |
|--------|-------|---------|
| `build-youtube-metadata.js` | Node | Per-clip titles, descriptions, tags |
| `upload-all-to-youtube.js` | Node, Python, Google OAuth | Batch upload with channel guard |
| `youtube-upload.py` | Python, Google OAuth | One upload |
| `youtube-manage.py` | Python, Google OAuth | Schedule, unschedule, privacy |
| `youtube-thumbnail.py` | Python, Google OAuth | Set a thumbnail |
| `fix-audio-stereo.sh` | ffmpeg | Left-only audio to stereo |
| `build-linkedin-drafts.js` | Node | Schedule and paste pack (optional) |
| `push-linkedin-to-ghl.js` | Node, GoHighLevel | Push drafts (optional) |
| `update-episode-page.js` | Node | Highlights for your site (optional) |

## Next

`/podcast-guest-comms` for the review email and asset pack.
