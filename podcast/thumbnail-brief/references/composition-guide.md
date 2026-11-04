# Composition guide

How the PNG gets built from the brief. Two paths.

## Path A: programmatic with `/thumbnail-generate`

The default. The sibling skill fills an HTML template and takes a headless Chrome screenshot, so no designer is needed.

Inputs it pulls:

- Everything in `brand` from the settings file
- Guest cutout from `<episode-folder>/guest-cutout.png`
- Hook and guest name from the brief

Output: `<episode-folder>/thumbnail.png` at 1280x720.

Keep the brief short on this path. The template handles the spatial logic, so the brief is a review checkpoint and a record of the choices.

## Path B: manual in Canva or Figma

Use when the user wants pixel-level control on one episode, or a guest frame needs hand work.

Add these steps to the brief:

```markdown
## Manual composition steps

1. Create a 1280x720 canvas.
2. Place the backdrop full-bleed.
3. Place the guest cutout on the left at the position in the layout spec.
4. Place the host cutout on the right, rotated -15deg.
5. Set the hook lines at 96px bold on their strips, with one highlight strip.
6. Add the name boxes and the badge.
7. Run the 320px preview check. Export PNG.
```

## Picking the path

Default to Path A. Use Path B only when the user asks for it on a given episode, and set `manual_override: true` in the brief's frontmatter so the record is clear.
