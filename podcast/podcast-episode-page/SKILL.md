---
name: podcast-episode-page
description: Write the website episode page as markdown for a podcast episode. Use when the user asks for "the website page for episode N", "podcast page for [guest]", "episode page for the latest one", "build the episode page" or anything about the episode's landing page on their own site (distinct from the YouTube description and the thumbnail). Outputs one episode-page.md with rich frontmatter (PodcastEpisode JSON-LD fields) and structured body sections: summary, takeaways, guest bio, resources, chapters and transcript.
version: 1.0.0
---

# /podcast-episode-page

Writes the structured markdown for an episode's page: hero meta, summary, takeaways, guest bio, resources, chapters, transcript. The frontmatter carries the fields a site builder needs for `PodcastEpisode` schema markup.

This skill is optional. If you have no site, skip it and let `/distribute` link to YouTube.

## Settings

Read the settings file first: `$PODCAST_CONFIG`, otherwise `~/.config/podcast-skills/config.json`. This skill uses `paths.episodes_root`, `show`, `voice`, `glossary` and `site`.

## When to invoke

- "website page for episode N" / "episode page for [guest]"
- "podcast page" / "build the episode page"

## Prerequisites

The episode folder needs:

- `transcript-clean.md` (required)
- `chapters.md` (required)
- `youtube-description.md` (required, the page reuses its title and summary)
- `pre-call-brief.md` (optional, for the angle and producer notes)
- `README.md` (episode number, guest, role, company, `guest_linkedin`, YouTube URL)

If the transcript or description is missing, stop with: "Run `/podcast-transcript` and `/youtube-description` first."

## Workflow

### 1. Resolve the episode folder

- "episode N" means `Episode N - *` under `paths.episodes_root`.
- A guest name means `Episode * - <Guest>*`.
- If ambiguous, ask.

### 2. Read all inputs

| Source | What you extract |
|--------|------------------|
| Episode `README.md` | episode number, guest, role, company, `guest_linkedin`, YouTube URL, status |
| `transcript-clean.md` | the full transcript, speaker labels, `duration_seconds`, `word_count` |
| `chapters.md` | the timestamp block |
| `youtube-description.md` | the chosen title, summary, "in this episode" bullets, resources |
| `pre-call-brief.md` | the guest intro (basis of the bio), producer notes (the angle) |
| Settings file | show description, audience, voice rules, glossary |
| `content-lessons.md` in `paths.episodes_root` | corrections from earlier episodes, if the file exists |

### 3. Generate the slug

Pattern: `episode-{N}-{guest-name-kebab}`, such as `episode-2-dana-reyes`.

- All lowercase
- Hyphens for spaces
- ASCII only (strip diacritics: Schröder becomes schroder)
- No special characters

### 4. Generate the page content

See `references/page-anatomy.md` for the structure and `references/schema-fields.md` for the JSON-LD fields.

### 5. Output structure

Save to `<episode-folder>/episode-page.md`. The permalink comes from `site.episode_path`.

````markdown
---
title: <show.name> with <Guest Name>
slug: episode-N-<guest-slug>
permalink: <site.episode_path with slug>
episode: N
guest: <Guest Name>
guest_role: <Role>
guest_company: <Company>
guest_linkedin: <URL>
duration_minutes: <minutes>
duration_seconds: <seconds>
publication_date: YYYY-MM-DD
youtube_url: <URL>
youtube_id: <video ID>
og_image: <permalink>/thumbnail.png
description: <SEO meta description, about 155 chars>
podcast: <show.slug>
status: draft
podcast_episode_schema:
  # see references/schema-fields.md
---

# Episode N: <Hero title>

**<Guest Name>**, <role> at <company> · <duration>m · <publication date>

## Episode Summary

<1 to 2 paragraphs>

## Key Takeaways

- <bullet 1>
- <bullet 2>

## Guest Bio

<1 to 2 paragraphs>

## Resources Mentioned

- <Resource>: <URL>

## Chapters

```
00:00 <chapter 1>
00:42 <chapter 2>
```

## Watch the Episode

[YOUTUBE_EMBED video_id="<youtube_id>"]

## Full Transcript

[full speaker-labelled transcript from transcript-clean.md]
````

### 6. Update the episode README and report back

Mark the episode page as done. Tell the user the file path, the slug, the expected URL (`site.base_url` plus the permalink), the page word count, and anything to verify, especially the ISO 8601 duration.

## Voice and style

- Use `voice.spelling` and apply `voice.rules`.
- Apply `glossary` spellings throughout, including in the transcript before pasting it in.

## Conventions

- **The page is paste-ready markdown, not final HTML.** Your site's renderer handles the layout, and the frontmatter carries the metadata.
- **The transcript goes in verbatim** after glossary fixes. It is long, and it is what search engines and AI assistants can quote from.
- **The guest-approval gate applies.** Do not publish the page until the guest has approved the episode (see `/distribute`).
- **Files are not overwritten** without confirmation.

## References

- `references/page-anatomy.md`: section-by-section spec and quality checks
- `references/schema-fields.md`: JSON-LD fields and the ISO 8601 duration helper
