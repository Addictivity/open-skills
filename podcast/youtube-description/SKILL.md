---
name: youtube-description
description: Write YouTube title options and a paste-ready description, with a tag list, for a podcast episode. Use when the user asks for "the YouTube description for episode N", "describe [guest]", "write the description for the latest episode" or anything about YouTube metadata for the podcast. Reads the episode's transcript, chapters, README and pre-call brief, plus the settings file. Outputs one youtube-description.md into the episode folder.
version: 1.0.0
---

# /youtube-description

Writes a paste-ready YouTube description: title options, description body, tag list, and notes on anything to check before publishing.

## Settings

Read the settings file first: `$PODCAST_CONFIG`, otherwise `~/.config/podcast-skills/config.json`. This skill uses `paths.episodes_root`, `show`, `voice`, `glossary`, `site` and `publishing.youtube` (including `host_cta_block`).

## When to invoke

- "youtube description for episode N"
- "describe episode 2" / "describe [guest]"
- "title and description for [episode or guest]"

## Prerequisites

The episode folder must contain `transcript-clean.md` and `chapters.md`. If they are missing, stop with: "Run `/podcast-transcript` first."

## Workflow

### 1. Resolve the episode folder

- "episode N" means `Episode N - *` under `paths.episodes_root`.
- A guest name means `Episode * - <Guest>*`.
- A YouTube URL means matching against episode README links.
- If ambiguous, ask.

### 2. Read all inputs

| Source | What you extract |
|--------|------------------|
| Episode `README.md` | episode number, guest name, role, company, YouTube URL, status, any notes |
| `pre-call-brief.md` | **the editorial angle**, the most important input if it exists. Producer notes capture the headline of the episode, and the intro holds the polished bio. |
| `transcript-clean.md` | stories, numbers, quotes, named tools, companies and people |
| `chapters.md` | the timestamp block, which you shorten in step 4 |
| Settings file | voice rules, audience, the host CTA block, glossary |
| `content-lessons.md` in `paths.episodes_root` | corrections from earlier episodes, if the file exists |

Apply the right-hand spellings from `glossary` everywhere, even where the transcript has it wrong.

### 3. Generate 5 title options

See `references/title-frameworks.md`. Each title must:

- Be 50 to 65 characters. Long titles get cut off, shortest on mobile.
- Surface the story angle from the brief, not a generic description of the episode.
- On a small channel, lead with the hook instead of the show name.
- Avoid em dashes. Use `|` or `:` as separators.
- Include the guest's name somewhere in the last 30% for search.

Give one option per pattern: story-led, curiosity, lesson-led, contrarian, achievement-led. For each, add a one-line rationale. Then recommend one.

### 4. Trim the chapters

AssemblyAI's headlines are full sentences, too long for YouTube. Rewrite each as a 4 to 7 word title.

- Keep every original timestamp.
- The first chapter must start at `00:00`.
- Use specific terms from the transcript.
- No periods at the end of titles.

### 5. Write the description body

Section-by-section spec in `references/description-anatomy.md`. In this order:

1. **Hook (first 2 lines):** the story angle in 25 words or fewer. This shows before "Show more".
2. **Episode summary:** 3 to 5 sentences on the guest's story and why it matters to `show.audience`.
3. **In this episode:** 5 to 8 specific bullets from the transcript, with named entities. Each should pass the test "would someone in my audience click for this?"
4. **Chapters:** the trimmed timestamps.
5. **Resources mentioned:** tools, books, frameworks and events from the transcript. Include URLs only when verified, and flag the rest in Notes.
6. **Guest CTA block:** fill in from the README. If `guest_linkedin` is missing, write `{{ADD GUEST LINKEDIN}}` and flag it in Notes.
7. **Host CTA block:** `publishing.youtube.host_cta_block` joined with line breaks, copied verbatim.
8. **Hashtags:** 3 to 5, mixing broad and specific, including `show.hashtag`.

### 6. Generate the tag list

15 to 20 backend tags, comma-separated, under YouTube's 500-character total. See `references/youtube-seo-rules.md`. Cover the guest and their company, sector keywords, episode topics, show name variants and audience keywords. Start from `publishing.youtube.tags`.

### 7. Write the output

Save to `<episode-folder>/youtube-description.md`. Do not overwrite an existing file without asking.

````markdown
---
title: Episode N - <Guest> - YouTube Description
date: YYYY-MM-DD
tags: [podcast, youtube, description]
status: complete
episode: N
guest: <Guest>
---

# Episode N - YouTube Description

## Title options

1. **<title 1>** (<char count> chars): <rationale>
2. **<title 2>** (<char count> chars): <rationale>
3. **<title 3>** (<char count> chars): <rationale>
4. **<title 4>** (<char count> chars): <rationale>
5. **<title 5>** (<char count> chars): <rationale>

## Description (paste-ready)

<full description text>

## Tags

```
<comma-separated tag list>
```

## Notes for the user

- <transcription quirks the description inherits>
- <missing URLs>
- <length warnings>
- <anything to verify before pasting>
````

Keep the `## Tags` heading as written: `/distribute` reads the tags from that section.

### 8. Update the episode README and report back

Note in the episode README that the description is done. Tell the user the file path, your recommended title with a one-sentence reason, and the items in Notes. When the user picks a title, add `**Chosen title:** ...` at the top of `youtube-description.md`, because later skills read it from there.

## Voice and style

- Use `voice.spelling` and apply `voice.rules`.
- Numbers over adjectives. Named things over generic ones.
- Emoji sparingly, only to mark sections in the CTA block.
- Read it aloud. Anything you would not say goes.

## Conventions

- The host CTA block is read verbatim from the settings file. Do not regenerate or paraphrase it.
- After each episode, append new corrections to `content-lessons.md` in `paths.episodes_root` so later episodes inherit them.

## References

- `references/description-anatomy.md`: section-by-section spec with examples
- `references/title-frameworks.md`: title patterns for interview podcasts
- `references/youtube-seo-rules.md`: keyword placement and the limits YouTube enforces

## Next

`/thumbnail-brief` and `/podcast-episode-page`.
