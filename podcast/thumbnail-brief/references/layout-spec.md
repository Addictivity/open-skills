# Layout spec

All measurements assume the YouTube canvas of 1280x720px (16:9). Colours and fonts come from `brand` in the settings file. This file is the spatial spec.

## Host and guest (default)

Use when `brand.assets.host_cutout` is set.

```
+----------------------------------------------------+
|                                                    |
|                   HOOK LINE 1                      |
|  [GUEST           [HOOK LINE 2]            [HOST   |
|   CUTOUT          [HOOK LINE 3]            CUTOUT  |
|   left,           [PUNCH LINE ]            right,  |
|   facing in]                               tilted] |
|  [GUEST NAME]        (badge)        [HOST NAME]    |
+----------------------------------------------------+
```

| Element | Position | Size | Notes |
|---------|----------|------|-------|
| Backdrop | full canvas | 1280x720 | Solid `thumbnail_background`, plus the optional image. |
| Guest cutout | left -70, bottom -20 | height about 820px | Transparent PNG. Tune per episode with the script's flags. |
| Host cutout | right -130, bottom -130 | width 780px | Rotated -15deg. The same asset every episode. |
| Hook | centred at 50% + 20px, top 100 | 96px bold, line-height 93px | Caps, three or four lines. |
| Badge (optional) | left 559, top 498 | 188px circle | Show mark inside. |
| Guest name box | left 40, top 520 | fits text, 40px bold caps | Rotated +1.4deg. |
| Host name box | right 42, top 524 | fits text, 40px bold caps | Rotated -2deg. |

## Solo

Use when there is no host cutout. The hook moves right to about 68% of the width, and the host image and name box drop out. Everything else stays.

## Rules for both

1. Guest on the left facing inward. Do not swap the sides unless the footage forces it.
2. The highlight colour appears on one hook line only.
3. The guest cutout has real transparency. A hard cut on the shoulders is fine, messy hair edges are not.
4. Text on the thumbnail is identity plus one hook. The video title lives in the title field.

## Preview-size check

Every thumbnail must pass this before it ships. Scale to 320px wide and confirm:

- The hook's punch line reads.
- The guest name reads.
- The guest's face is recognisable as a face.

The badge can compress to barely visible at that size. It reads at full size and on the channel page.
