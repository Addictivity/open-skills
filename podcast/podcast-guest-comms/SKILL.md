---
name: podcast-guest-comms
description: Guest communications for a podcast after the edit. Two modes. "review" drafts the email to the guest with the unlisted YouTube link, the title, what to check, the publish date and a reply-by date, with an apology first when the wait has been long. "assets" builds the guest asset pack (rendered shorts, thumbnail, a README with the clip schedule and links) and drafts the share email. Use when the user says "email the guest the review link", "guest review email for episode N", "share the clips with the guest", "asset pack for [guest]", "send [guest] the shorts", or when /distribute has uploaded the episode unlisted (review) and the shorts are rendered (assets). Drafts only, never sends.
version: 1.0.0
---

# /podcast-guest-comms

Two emails every guest gets, both written as drafts for the user to send, so no guest first hears the air date on launch day.

## Settings

Read the settings file first: `$PODCAST_CONFIG`, otherwise `~/.config/podcast-skills/config.json`. This skill uses `paths.episodes_root`, `paths.media_archive`, `show`, `voice`, `site` and `guest_comms`.

## When to invoke

- **review:** as soon as `/distribute` has the episode on YouTube unlisted (`distribute/youtube-uploads.json` has `episode.video_id`). Before the public flip.
- **assets:** as soon as the shorts are rendered and uploaded. Usually the same day as review, but the email goes after the guest signs off.

## Inputs (read these first)

| Source | What you take |
|--------|---------------|
| Episode `README.md` | guest name, first name, company, `## Guest requests` (off-limits items, anything they asked for), `recorded:` date, status |
| `youtube-description.md` | the chosen title |
| `distribute/youtube-uploads.json` | episode video ID, per-clip IDs, and `publish_at` for anything scheduled |
| `distribute/linkedin-drafts.json` | the posting schedule, if LinkedIn is on (the first post date is when the episode must be public) |
| `clips.md` | clip titles for the asset README |
| The user's email, if connected | how long the guest has waited, what they asked, their tone, their address |
| Settings file | voice rules, sign-off |

## Where drafts go

If an email connector with a draft tool is available, create the draft there. Otherwise write it to `<episode-folder>/guest-comms/<mode>-email.md` with the subject on the first line. Never send.

## Mode 1: review email

Short paragraphs, in the user's voice. Apply `voice` from the settings file.

1. **Apology first if the wait was long.** Long means more than four weeks since recording, or the guest has chased. Own it plainly and thank them for their patience. No excuses.
2. **The link.** The unlisted YouTube URL. Say it is unlisted, so only people with the link can watch.
3. **What to check.** Two items at most: anything they would rather cut (reference any off-limits item from `## Guest requests` and confirm it was respected), and the title.
4. **The plan and the deadline.** Publish date and reply-by date, with the clip cadence. No file holds these two dates, so ask the user. State that silence means good to go, so the launch is not blocked.
5. **What comes next for them.** The asset pack is coming, and they are welcome to share from their own page once tagged in the posts.
6. **Close warm.** One line on their story, then `guest_comms.email_signoff`.

Subject pattern: `Your <show.name> episode is ready`. Add `(and an apology)` when point 1 applies.

Log in the episode README under `## Guest requests`: the dates, and what the guest comes back with. If they ask for a cut, that goes through `/podcast-edit`, then a re-upload (see `/distribute`).

## Mode 2: asset pack

1. **Build the folder** at `guest_comms.asset_pack_dir/Episode N - Guest/`. A folder synced to a cloud drive makes sharing easy. Copy in:
   - the rendered shorts, renamed `EPn-clip-N.mp4`
   - `thumbnail.png`, renamed `EPn-thumbnail.png`
   - a `README.txt` listing the episode link, the page link, each clip's title, go-live date and YouTube Shorts URL, and a line asking them to tag the show and the host when they share
2. **Share link.** Ask the user to create a view-only link for the folder and paste it into the draft.
3. **Draft the email:** the folder link, what is in it, the posting dates so they can mirror or avoid them, the ask to tag the show and host, and the episode page as the one link to use in their own posts. It goes after the guest has signed off the review.

## Rules

- Drafts only. The user sends.
- One link in anything the guest might paste into a post: the episode page if there is one, otherwise the YouTube URL.
- Off-limits items from pre-call conversations get confirmed back to the guest in the review email, not assumed.
- No em dashes or emoji in either draft unless `voice` says otherwise.

## Next

The user flips the episode public and approves the posts. See `/distribute`.
