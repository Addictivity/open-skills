---
name: thumbnail-generate
description: Build a podcast thumbnail PNG in a fixed visual system. Use when the user asks to "generate the thumbnail for episode N", "build the thumbnail PNG for [guest]", "render the thumbnail" or anything about creating the actual image rather than the brief. Pulls an expressive guest still from the episode footage, cuts out the background, and composites it with the show's assets and type system through an HTML template and a headless Chrome screenshot. Outputs a 1280x720 thumbnail.png in the episode folder.
version: 1.0.0
---

# /thumbnail-generate

Builds the thumbnail PNG. The layout is an HTML template, so it renders the same every time and you can tweak it in a browser.

## Settings

Read the settings file first: `$PODCAST_CONFIG`, otherwise `~/.config/podcast-skills/config.json`. This skill uses `show.host`, `brand.colours`, `brand.fonts.thumbnail`, `brand.font_files` and `brand.assets`.

## The visual system

- **Canvas:** 1280x720 on `thumbnail_background`, with an optional pre-flattened backdrop image (`thumbnail_background_image`). A tilted mosaic of episode stills at low opacity works well.
- **Guest cutout left,** facing inward (right), waist-up with their mic in shot. Taken from episode footage, not a supplied headshot.
- **Host cutout right** (`host_cutout`, the same asset every episode), rotated -15deg, bottom-right. Leave it null for a solo layout: no host image or name box, and the hook moves right.
- **Hook text centre:** 96px bold, line-height 93px, letter-spacing -2.88px, caps, three or four short lines. Each line sits bare or on a dark strip, and exactly one sits on the highlight strip: the punch word.
- **Badge** (`show_badge`, optional): a small show mark in a 188px circle, centre-bottom.
- **Name boxes:** dark fill, 4px border, 40px bold uppercase. Guest box lower-left rotated +1.4deg, host box lower-right rotated -2deg.

The default font is Sora (open licence, bundled in `fonts/`). To use your own, add it to `brand.font_files` and set `brand.fonts.thumbnail`.

## Workflow

### 1. Resolve the episode folder

`paths.episodes_root/Episode N - Guest Name`. If `thumbnail-brief.md` exists, read the hook and frame choice from it.

### 2. Pick the guest frame from the episode footage

No headshot needed. The guest camera has 30 minutes of well-lit frames.

- Extract a sampling grid (`ffmpeg -i guest-cam.mp4 -vf "fps=1/60,scale=320:-1,tile=6x6" grid.jpg`) and look for expressive moments, then pull full-res frames at the best timestamps.
- You want: waist-up, facing inward (a guest seated left should look right), warm or emphatic expression, mic in shot.
- Crop the person and mic from the frame. For a left-seated guest in 1080p, roughly `crop=760:1080:0:0`.

### 3. Cut out the background

Use whichever background remover the user has and save the result as `<episode-folder>/guest-cutout.png` (transparent PNG). Options:

- An image MCP with a remove-background tool, if one is connected (paid credits on most).
- remove.bg (paid beyond its free previews).
- macOS Preview or Finder's Remove Background (free, Mac only).

Check the edges at full size. A hard cut on the shoulders is fine, messy hair is not.

### 4. Write the hook

Three or four all-caps lines, one highlight. Source: the thumbnail brief or the hook candidates in `clips.md`. Match the episode title's angle, so the launch clip and thumbnail back it up.

Rules: no full stops, short words render best at 96px, and about 10 characters is the longest a line can run before it crowds the cutouts. Question marks are fine.

### 5. Render

```bash
python3 ~/.claude/skills/thumbnail-generate/scripts/generate.py \
  --episode-folder "<episode-folder>" \
  --guest-name "Dana Reyes" \
  --hook "THE ROAST|_NOBODY|_WANTED|*TO BUY"
```

A `_` prefix puts a line on the dark strip and `*` on the highlight strip. Add `--force` to overwrite. The script writes `thumbnail.html` beside the PNG, so you can open it in a browser while tuning.

### 6. Iterate sizes with the user

Show the PNG. Adjust `--guest-height`, `--guest-left` and `--guest-bottom` until the balance is right, then check the preview-size test in `/thumbnail-brief`'s layout spec.

### 7. Update the episode README

Mark the thumbnail as done.

## Working in a design tool instead

If the show keeps its thumbnails in Figma or Canva, you can duplicate the newest episode's frame there and swap the cutout and text. Two Figma gotchas: `\n` in a text node creates paragraphs, so set paragraph spacing to 0 or the line pitch breaks. And remove any rounded corners and drop shadow from the frame before exporting, so the PNG comes out flat.

## Rules

- Exactly one highlight strip per thumbnail.
- Apply `glossary` spellings to the guest name.
- Guest faces are real photos, never AI-generated.

## Failure modes

- **No background remover to hand:** ask the user to cut out by hand with macOS Preview.
- **Chrome not found:** install Chrome or set `CHROME_PATH`.
- **Guest sits on the right:** flip the crop and mirror the frame so they face inward on the left.
- **Two guests:** composite both cutouts into one transparent PNG and pass it with `--guest-cutout`. Put both names in `--guest-name`.

## Next

`/distribute` sets the thumbnail on the uploaded video with `youtube-thumbnail.py`.
