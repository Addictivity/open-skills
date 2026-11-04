---
name: thumbnail-brief
description: Write a per-episode thumbnail brief for a podcast episode. Use when the user asks for "the thumbnail brief for episode N", "thumbnail for [guest]", "design the thumbnail for the latest episode" or anything about planning a podcast thumbnail. Reads the episode's transcript, chapters, README, pre-call brief and YouTube description, chooses the hook and guest frame, confirms assets are ready, and writes a brief that feeds /thumbnail-generate.
version: 1.0.0
---

# /thumbnail-brief

Writes the per-episode brief for a thumbnail. It is the input to `/thumbnail-generate` and the checkpoint where the user confirms the hook and frame before any image gets built.

## Settings

Read the settings file first: `$PODCAST_CONFIG`, otherwise `~/.config/podcast-skills/config.json`. This skill uses `paths.episodes_root`, `show`, `voice`, `glossary` and `brand.assets`.

## When to invoke

- "thumbnail brief for episode N"
- "thumbnail for [guest]" / "thumbnail for the latest episode"
- "design the thumbnail" / "thumbnail concept"

## Prerequisites

The episode folder should contain:

- `transcript-clean.md` and `chapters.md`
- `README.md` with frontmatter `episode`, `guest`, `guest_role`, `guest_company`
- `pre-call-brief.md` if you have one (for the headline angle)
- `youtube-description.md` (the chosen title gives context). If it is missing, the skill can still run, but warn the user that title and thumbnail should agree.

## Workflow

### 1. Resolve the episode folder

- "episode N" means `Episode N - *` under `paths.episodes_root`.
- A guest name means `Episode * - <Guest>*`.
- If ambiguous, ask.

### 2. Read all inputs

| File | What you extract |
|------|------------------|
| Episode `README.md` | episode number, guest name, role, company, status |
| `pre-call-brief.md` | the editorial angle, the most important input |
| `transcript-clean.md` | the line that carries the episode |
| `youtube-description.md` | the chosen title, which the hook supports without repeating word for word |
| `clips.md` | hook candidates, if `/shorts` has already run |
| `content-lessons.md` in `paths.episodes_root` | corrections from earlier episodes, if the file exists |

### 3. Pick the layout

See `references/layout-spec.md`.

- **Host and guest:** the default when `brand.assets.host_cutout` is set.
- **Solo:** guest only, hook to the right, when there is no host cutout.

### 4. Write the hook

Three or four all-caps lines, about 10 characters at most per line, no full stops. Exactly one line carries the highlight strip: the punch word. Write two or three hook options and recommend one, with a sentence on why it fits the angle.

Be provocative about the topic and always positive about the guest. A guest should be happy to share their own thumbnail. Check anything in the README's `## Guest requests`.

### 5. Pick the guest frame

Note the camera and timestamp of two or three candidate frames: waist-up, facing inward, warm or emphatic expression, mic in shot. If the footage is not to hand, write down what to look for.

### 6. Confirm asset readiness

| Asset | Check |
|-------|-------|
| Guest cutout | `<episode-folder>/guest-cutout.png` exists, or the frame is chosen and ready to cut out |
| Host cutout | `brand.assets.host_cutout` set and the file exists (optional) |
| Show badge | `brand.assets.show_badge` set and the file exists (optional) |
| Backdrop | `brand.assets.thumbnail_background_image` set and the file exists (optional) |

Optional assets missing just means a simpler layout. No guest frame or cutout means the status is `blocked-on-asset`.

### 7. Write the brief

Save to `<episode-folder>/thumbnail-brief.md`:

```markdown
---
title: Episode N - <Guest> - Thumbnail Brief
date: YYYY-MM-DD
tags: [podcast, thumbnail, design-brief]
status: complete | blocked-on-asset
episode: N
guest: <Guest>
layout: host-and-guest | solo
---

# Episode N - <Guest> - Thumbnail Brief

## Hook

Recommended: `LINE 1|_LINE 2|_LINE 3|*PUNCH`

<one sentence on why it fits the angle>

Alternatives:
- `...`
- `...`

## Guest frame

- <camera> at <timestamp>: <what the frame shows>

## Text

| Field | Value |
|-------|-------|
| Guest name box | `GUEST NAME` |
| Host name box | `HOST NAME` or none |

## Asset readiness

| Asset | Status | Path |
|-------|--------|------|
| Guest cutout | ready or missing | ... |
| Host cutout | ready / missing / not used | ... |
| Show badge | ready / missing / not used | ... |
| Backdrop | ready / missing / not used | ... |

## Editorial rationale

<one paragraph: how the hook and frame serve the headline angle>

## Notes for the user

- <missing assets>
- <anything to verify, such as the guest name spelling>
- <decisions made on the user's behalf>
```

Do not overwrite an existing `thumbnail-brief.md` without asking.

### 8. Update the episode README and report back

Mark the thumbnail row as brief complete, either ready or blocked. Tell the user the file path, the recommended hook with a reason, whether assets are ready, and that `/thumbnail-generate` is next.

## Voice and style

- Apply `voice` and `glossary` from the settings file to any prose and to the guest name.
- The thumbnail carries identity and one hook. It is a different job from the title, so do not paste the title onto it.
- Guest faces are real photos, never AI-generated.

## References

- `references/layout-spec.md`: where everything goes, and the preview-size check.
- `references/composition-guide.md`: the programmatic route and the manual route.
