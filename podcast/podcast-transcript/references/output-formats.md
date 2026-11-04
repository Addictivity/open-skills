# Output formats

The skill writes four files into the episode folder. The examples show the shape, and the guest is made up.

## `transcript-raw.txt`

One paragraph of plain text from AssemblyAI's `text` field, with no labels or timestamps. Used for archive and re-processing.

## `transcript-clean.md`

Speaker-labelled and timestamped. Every later skill reads this one.

```markdown
---
title: Episode 2 - Dana Reyes - Transcript
date: 2026-05-05
tags: [podcast, transcript, example-show]
status: complete
episode: 2
guest: Dana Reyes
host: Sam Host
duration_seconds: 1834
word_count: 5421
speakers: ["Sam Host", "Dana Reyes"]
---

[00:00] **Sam Host:** Welcome to the show. Today's guest roasts 40 tonnes of coffee a year...

[00:42] **Dana Reyes:** Thanks for having me. So Fernhill started in a garage...
```

Body format: `[MM:SS] **Speaker Name:** utterance text`, with a blank line between utterances. Timestamps become `HH:MM:SS` for episodes over an hour.

## `chapters.md`

Timed sections from AssemblyAI's summarization, for YouTube descriptions and for reading.

````markdown
# Episode 2 - Chapters

## YouTube timestamps

```
00:00 Introduction and show format
01:30 Dana on starting Fernhill in a garage
07:42 The first wholesale account
```

## Chapter summaries

### 00:00 - Introduction and show format
The host sets out the premise of the show and introduces the guest.

### 01:30 - Dana on starting Fernhill in a garage
Dana explains how the roastery began...
````

The fenced block pastes straight into a YouTube description, where it becomes clickable chapters. `/youtube-description` shortens these headlines to 4 to 7 words.

## `transcript-words.json`

An array of `{ "text", "start", "end", "speaker" }` with times in milliseconds. This is the timing truth for cutting shorts. Word end times can run long, so confirm exact cut points with `silencedetect` on the audio.

## Speaker mapping rules

AssemblyAI labels speakers `A`, `B`, `C`. The script maps them in order of first appearance:

1. First voice: the host (`show.host` or `--host-name`).
2. Second voice: the guest (`--guest-name`).
3. Anyone after that: `Guest 2`, `Guest 3`. The script prints a warning, and you search and replace the labels by hand.
