# YouTube description anatomy

The eight-section structure. Order matters, because people read from the top. Examples use a made-up guest: Dana Reyes, founder of Fernhill Coffee, on a show for independent coffee shop owners.

## Visibility regions

| Region | What | Length |
|--------|------|--------|
| Above the fold | Roughly the first 125 characters, before "Show more" | First 2 sentences |
| Click to expand | Everything else | Up to YouTube's 5,000 character limit |

If the first two lines do not earn the click, nobody reads the rest. Front-load the story angle.

## Section 1: hook (first 2 lines)

**Length:** about 25 words.
**Goal:** make the viewer feel this episode is for them.
**Pattern:** a specific tension, then why the audience cares.

Good:
> Most roasters chase bigger accounts. Dana Reyes lost her biggest one and built a better business from what was left. Here's what she changed.

Too generic:
> Dana Reyes, founder of Fernhill Coffee, joins the show to talk about coffee.

## Section 2: episode summary

**Length:** 3 to 5 sentences, 80 to 150 words.
**Must include:** who the guest is and why their story matters to the audience.

## Section 3: "In this episode"

**Length:** 5 to 8 bullets, 10 to 20 words each.
**Must include:** specific stories with named entities, at least one number or date, and a mix of tactical advice and wider insight. Start each bullet with a verb or a question.

Good:
- How Dana replaced a single wholesale account worth 60% of revenue
- The pricing change that stopped Fernhill losing money on its best seller
- Why she hires baristas for attitude and trains the rest

Too vague:
- Coffee business strategies
- Career lessons

## Section 4: chapters

**Format:** plain text, one per line: `MM:SS Title`.

**Rules YouTube enforces:**
- The first timestamp must be `00:00`.
- At least 3 chapters, each at least 10 seconds long.

**House rules:** 4 to 7 words each, no full stop at the end, no em dashes.

Trim from the auto-generated headlines:

| Raw headline | Trimmed |
|---|---|
| `Dana Reyes explains how she started Fernhill Coffee in a garage` | `Starting Fernhill in a garage` |
| `How did you replace the account you lost` | `Replacing the lost account` |

## Section 5: resources mentioned

A bulleted list of every named tool, book, framework, person or organisation in the episode. Include URLs only when verified. Otherwise list the name and flag it in the Notes section of the output file.

## Section 6: guest CTA block

```
CONNECT WITH {{GUEST FIRST NAME}}

{{GUEST FULL NAME}}, {{ROLE}} at {{COMPANY}}
LinkedIn: {{GUEST LINKEDIN URL}}
{{COMPANY}}: {{COMPANY URL}}
```

Add a line per company if the guest runs more than one. If `guest_linkedin` is missing from the README, write `{{ADD GUEST LINKEDIN}}` and call it out in Notes.

## Section 7: host CTA block

`publishing.youtube.host_cta_block` from the settings file, joined with line breaks. Copy it verbatim, dividers and emoji included. Do not regenerate it.

## Section 8: hashtags

**Where:** the last line.
**Length:** 3 to 5, separated by spaces.
**Pattern:** a mix of broad and specific, always including `show.hashtag`.

```
#coffee #coffeeshop #wholesalecoffee #podcast #exampleshow
```

Avoid long lists, all-generic tags (could be anyone) and all-specific ones (no broad pickup).

## Total length

Aim for 1,500 to 3,000 characters. If the real content comes in under that, leave it. Do not pad.
