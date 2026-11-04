# Page anatomy

The structure of an episode page.

## Frontmatter

The site renderer uses this to build the hero, SEO meta tags and JSON-LD schema.

| Field | Source | Notes |
|-------|--------|-------|
| `title` | constructed | `<show.name> with <Guest Name>` |
| `slug` | constructed | `episode-N-<guest-name-kebab>`, lowercase, hyphens, ASCII only |
| `permalink` | `site.episode_path` | with `{slug}` filled in |
| `episode` | README | integer |
| `guest` | README | full name with glossary spellings |
| `guest_role` | README | |
| `guest_company` | README | |
| `guest_linkedin` | README | URL |
| `duration_minutes` | transcript | `duration_seconds` / 60, integer |
| `duration_seconds` | transcript frontmatter | integer |
| `publication_date` | ask if not in README | YYYY-MM-DD |
| `youtube_url` | README | full URL |
| `youtube_id` | from the URL | the 11-character ID |
| `og_image` | constructed | relative path to the thumbnail |
| `description` | summary | about 155 characters |
| `podcast` | `show.slug` | |
| `status` | constant | `draft` until the user flips it to `published` |
| `podcast_episode_schema` | constructed | see `schema-fields.md` |

## Body sections, in order

### 1. Hero block (under the H1)

```markdown
**<Guest Name>**, <role> at <company> · <duration>m · <publication date>
```

One line, with a middle dot as the separator.

### 2. Episode Summary

**Length:** 1 to 2 paragraphs, 120 to 200 words.
**Source:** the hook and summary from `youtube-description.md`, expanded into an editorial intro.
**Pattern:** open with the headline angle, establish who the guest is and why their view matters, close with a line leading into the key points.

### 3. Key Takeaways

**Length:** 5 to 8 bullets, 12 to 22 words each.
**Source:** the "In this episode" section of `youtube-description.md`.
**Pattern:** start each with a verb or noun phrase, not a question. Use named tools, awards, companies and numbers.

### 4. Guest Bio

**Length:** 1 to 2 paragraphs, 80 to 150 words.
**Source:** the guest intro from the pre-call brief, expanded with details from the transcript.
**Pattern:** who they are and their current role, then how they got there, then notable achievements with numbers or award names. Present tense.

### 5. Resources Mentioned

**Length:** 3 to 10 bullets.
**Format:** `**Resource**: URL`, or `Resource: <description> (URL TBC)` if unverified, flagged for the user. Every URL must load.

### 6. Chapters

The timestamps from `youtube-description.md` in a fenced block, `MM:SS Title` per line. A site renderer can turn these into links.

### 7. Watch the Episode

One line: `[YOUTUBE_EMBED video_id="<id>"]`. Sites differ here (`{{< youtube ID >}}` for Hugo, `<YouTubeEmbed videoId="ID" />` for MDX). Swap in whichever yours uses.

### 8. Full Transcript

The body of `transcript-clean.md` with the frontmatter stripped, keeping `[MM:SS] **Speaker:** text`. Apply glossary fixes first. It can run to several thousand words, so have the site render it in a collapsible section.

## Quality checks

- [ ] Slug is lowercase ASCII with hyphens
- [ ] Frontmatter has every field
- [ ] Summary opens with the angle, not "In this episode..."
- [ ] Takeaways have 5 or more bullets, each starting with a verb or noun phrase
- [ ] Guest bio uses glossary spellings
- [ ] Resources have URLs or are flagged
- [ ] Chapters are in a fenced block
- [ ] The embed uses your site's format
- [ ] Transcript has glossary fixes applied
- [ ] `voice` rules applied throughout
