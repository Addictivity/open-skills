#!/usr/bin/env python3
"""
thumbnail-generate: build a 1280x720 podcast thumbnail from an HTML template
with a headless Chrome screenshot. No Python packages needed.

Usage:
    generate.py --episode-folder "/path/to/Episode N - Guest" \\
        --guest-name "Tamsin Vell" \\
        --hook "THE ROAST|_NOBODY|_WANTED|*TO BUY" \\
        [--guest-cutout path.png] [--output path.png] [--force] [--dry-run] [--config path]
        [--guest-height 820] [--guest-left -70] [--guest-bottom -20]

Hook lines are split by |. A line starting with _ sits on a dark strip, and a line
starting with * sits on the highlight strip (exactly one per thumbnail).

--dry-run writes thumbnail.html beside the output and skips Chrome.
"""

import argparse
import html
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path

DEFAULT_CONFIG = "~/.config/podcast-skills/config.json"
SKILL_DIR = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL_DIR / "template" / "thumbnail.html"
MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def load_config(path=None):
    p = Path(path or os.environ.get("PODCAST_CONFIG") or DEFAULT_CONFIG).expanduser()
    if not p.exists():
        sys.exit(f"ERROR: settings file not found: {p}\nCopy podcast/config.example.json there and fill it in, or pass --config.")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"ERROR: {p} is not valid JSON: {e}")


def parse_hook(hook):
    """Turn 'A|_B|*C' into [(text, style)] and enforce the rules."""
    lines = []
    for raw in hook.split("|"):
        raw = raw.strip()
        style = {"_": "dark", "*": "highlight"}.get(raw[:1], "plain")
        lines.append((raw[1:].strip() if style != "plain" else raw, style))
    if not 1 <= len(lines) <= 4:
        sys.exit("ERROR: use one to four hook lines.")
    if sum(1 for _, s in lines if s == "highlight") != 1:
        sys.exit("ERROR: the hook needs exactly one highlight line (start it with *).")
    for text, _ in lines:
        if text.endswith("."):
            sys.exit(f"ERROR: no full stops in the hook: {text!r}")
        if len(text) > 10:
            print(f"WARNING: {text!r} is over 10 characters and may crowd the cutouts at 96px.", flush=True)
    return lines


def hook_html(lines):
    out = []
    for text, style in lines:
        safe = html.escape(text.upper())
        if style == "dark":
            safe = f'<span class="box-dark">{safe}</span>'
        elif style == "highlight":
            safe = f'<span class="box-highlight">{safe}</span>'
        out.append(f'<span class="line">{safe}</span>')
    return "\n    ".join(out)


def font_face(family, config):
    """@font-face CSS for a configured or bundled font. Empty means a system font."""
    custom = ((config.get("brand") or {}).get("font_files") or {}).get(family)
    path = Path(custom).expanduser() if custom else SKILL_DIR / "fonts" / f"{family.replace(' ', '')}-Variable.ttf"
    if not path.exists():
        print(f"NOTE: no font file for {family!r}, relying on an installed system font.", flush=True)
        return ""
    return (f"@font-face {{ font-family: '{family}'; src: url('{path.resolve().as_uri()}') "
            f"format('truetype-variations'); font-weight: 100 800; }}")


def asset_uri(value, label):
    if not value:
        return None
    p = Path(value).expanduser()
    if not p.exists():
        sys.exit(f"ERROR: {label} not found: {p}")
    return p.resolve().as_uri()


def find_chrome():
    for candidate in (os.environ.get("CHROME_PATH"), MAC_CHROME):
        if candidate and Path(candidate).exists():
            return candidate
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"):
        found = shutil.which(name)
        if found:
            return found
    return None


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def main():
    parser = argparse.ArgumentParser(description="Build a podcast thumbnail PNG.")
    parser.add_argument("--episode-folder", required=True)
    parser.add_argument("--guest-name", required=True)
    parser.add_argument("--hook", required=True, help="Lines split by |. _ prefix: dark strip. * prefix: highlight strip.")
    parser.add_argument("--guest-cutout", help="Transparent PNG. Defaults to <episode-folder>/guest-cutout.png.")
    parser.add_argument("--output", help="Defaults to <episode-folder>/thumbnail.png.")
    parser.add_argument("--guest-height", type=int, default=820)
    parser.add_argument("--guest-left", type=int, default=-70)
    parser.add_argument("--guest-bottom", type=int, default=-20)
    parser.add_argument("--config")
    parser.add_argument("--force", action="store_true", help="Overwrite existing output.")
    parser.add_argument("--dry-run", action="store_true", help="Write the HTML and skip the screenshot.")
    args = parser.parse_args()

    config = load_config(args.config)
    brand = config.get("brand") or {}
    colours = brand.get("colours") or {}
    assets = brand.get("assets") or {}
    family = (brand.get("fonts") or {}).get("thumbnail", "Sora")
    host = (config.get("show") or {}).get("host", "")

    episode_dir = Path(args.episode_folder).expanduser().resolve()
    if not episode_dir.exists():
        sys.exit(f"ERROR: episode folder not found: {episode_dir}")
    cutout = Path(args.guest_cutout).expanduser() if args.guest_cutout else episode_dir / "guest-cutout.png"
    if not cutout.exists():
        sys.exit(f"ERROR: guest cutout not found: {cutout}\nCut the guest out of an episode frame first (see SKILL.md).")
    output = Path(args.output).expanduser().resolve() if args.output else episode_dir / "thumbnail.png"
    if output.exists() and not args.force and not args.dry_run:
        sys.exit(f"ERROR: {output} exists. Use --force to overwrite.")

    lines = parse_hook(args.hook)
    host_uri = asset_uri(assets.get("host_cutout"), "brand.assets.host_cutout")
    badge_uri = asset_uri(assets.get("show_badge"), "brand.assets.show_badge")
    background_uri = asset_uri(assets.get("thumbnail_background_image"), "brand.assets.thumbnail_background_image")

    # With no host cutout the layout goes solo: no host image or name box, and the hook
    # moves right to fill the space.
    values = {
        "FONT_FACE": font_face(family, config),
        "FONT_FAMILY": family,
        "COLOUR_BACKGROUND": colours.get("thumbnail_background", "#141414"),
        "COLOUR_STRIP": colours.get("thumbnail_strip", "#2B2B2B"),
        "COLOUR_HIGHLIGHT": colours.get("thumbnail_highlight", "#2A9D8F"),
        "COLOUR_TEXT": colours.get("thumbnail_text", "#FFFFFF"),
        "GUEST_CUTOUT": cutout.resolve().as_uri(),
        "GUEST_HEIGHT": str(args.guest_height),
        "GUEST_LEFT": str(args.guest_left),
        "GUEST_BOTTOM": str(args.guest_bottom),
        "HOOK_LEFT": "calc(50% + 20px)" if host_uri else "68%",
        "HOOK_LINES": hook_html(lines),
        "GUEST_NAME": html.escape(args.guest_name),
        "BACKGROUND_BLOCK": f'<div class="background"><img src="{background_uri}"></div>' if background_uri else "",
        "HOST_BLOCK": f'<img class="host" src="{host_uri}">' if host_uri else "",
        "HOST_NAME_BLOCK": f'<div class="name name-host">{html.escape(host)}</div>' if host_uri else "",
        "BADGE_BLOCK": f'<div class="badge"><img src="{badge_uri}"></div>' if badge_uri else "",
    }
    page = TEMPLATE.read_text(encoding="utf-8")
    for key, value in values.items():
        page = page.replace("{{" + key + "}}", value)

    html_path = output.with_suffix(".html")
    html_path.write_text(page, encoding="utf-8")
    print(f"Wrote {html_path}", flush=True)
    if args.dry_run:
        print("Dry run: skipped the screenshot.", flush=True)
        return

    chrome = find_chrome()
    if not chrome:
        sys.exit("ERROR: Chrome not found. Install Chrome or set CHROME_PATH. The HTML above is ready to open by hand.")
    subprocess.run(
        [chrome, "--headless", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
         "--force-device-scale-factor=1", "--window-size=1280,720", "--virtual-time-budget=3000",
         f"--screenshot={output}", html_path.as_uri()],
        check=True, capture_output=True,
    )
    width, height = png_size(output)
    if (width, height) != (1280, 720):
        sys.exit(f"ERROR: screenshot came out {width}x{height}, expected 1280x720.")
    print(f"Done: {output} ({width}x{height})", flush=True)


if __name__ == "__main__":
    main()
