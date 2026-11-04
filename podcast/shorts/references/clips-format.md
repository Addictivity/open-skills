# clips.md format

`/shorts` and `/distribute` both parse this file, so keep the headings and bold labels exactly as written. The example is made up.

````markdown
---
title: Episode 2 - Dana Reyes - Short-form Clips
episode: 2
guest: Dana Reyes
---

# Episode 2 - Short-form Clips

## Editor reference table

| # | Clip | Master IN | Master OUT | Length |
|---|------|-----------|------------|--------|
| 1 | We lost 60% of revenue on a phone call | 04:48 | 05:39 | ~51s |

---

## Clip 1 - We lost 60% of revenue on a phone call

**Master:** `04:48 - 05:39` (~51s)

**Pull quote (verbatim):**
> "They rang on a Tuesday. By the Friday, 60% of our revenue had gone."

**Why this clip works:** One line on why the audience will care.

**LinkedIn hook (line 1):**
> They rang on a Tuesday.

**LinkedIn caption:**
> They rang on a Tuesday. By the Friday, 60% of Fernhill's revenue had gone.
>
> Dana Reyes on what she changed next.

**On-screen text:**
- 00:02 - 00:06: `They rang on. a Tuesday.` @Tuesday
- 00:11 - 00:15: `60% of our. revenue.` @revenue
- 00:30 - 00:34: `What came. next?` @next

**Cut style:** Talking head on the guest. Host reaction cut at their "yeah" beats.

---

## Posting order

| Slot | When | Clip | Reason |
|------|------|------|--------|
| 1 | Week 1, first slot | Clip 1 Lost account | Launch clip. Matches the title and thumbnail. |
````

## Fields the scripts read

| Label | Used by | Notes |
|-------|---------|-------|
| `## Clip N - Title` | everything | A hyphen, en dash or em dash after the number all parse. Use a hyphen. |
| `**Pull quote...:**` | `/distribute` | Blockquote. Fallback description for YouTube. |
| `**LinkedIn hook...:**` | `/distribute` | Becomes the YouTube Short title (100 characters at most) and the first line of the post. |
| `**LinkedIn caption:**` | `/distribute` | Blockquote. Blank `>` lines become paragraph breaks. |
| `**On-screen text:**` | `/shorts` | One beat per line. See below. |
| `## Posting order` | `/distribute` | A table with the clip in the third column. The order sets the schedule. |

## Writing a beat

`- 00:02 - 00:06: `Accent line. main.` @anchor`

- **The sentence split matters.** Write two sentences with a full stop on each. The first becomes the accent, the second the main. A main with no terminal stop falls back to "last 1 to 2 words" and can drag the accent's full stop into it. Stops never render on screen.
- **The main is 1 to 2 words,** in lowercase, except all-caps acronyms.
- **The accent stays under about 28 characters,** because it has no auto-fit.
- **The `@anchor` times the beat.** The beat starts 0.4s before that word is spoken. Pick a word the transcript heard (check the JSON, it hears what it hears) and one that appears only once in the clip, because the first match wins. Anchors must also fall at least 1s after the previous anchor.
- **The timestamps are only a fallback** for a missing or unmatched anchor. Do not ship on the fallback.
- **Verbatim over paraphrase.** Beat words are what was said. Numerals for spoken numbers are fine.
