# Open Skills

Claude Code skills you can use as they are, or change to suit how you work. They come from [Addictivity](https://addictivity.com), and the first release is a pack for producing a video podcast.

> **TODO:** link to the addictivity.com page for this pack once it exists.

## The podcast pack

Nine skills that take an interview podcast from raw recording to published episode and shorts. Addictivity built them to produce its own show, then stripped out everything specific to that show. Your show's name, brand, paths and publishing targets all live in one settings file.

It suits someone who records long-form interviews, is comfortable in a terminal, and would rather direct Claude Code than click through an editor for every episode. Expect some setup: there are API keys to add, and the multicam edit needs a specific Mac editor.

### The pipeline

```
Raw recording (3 cameras + 2 lav mics)
  │
  ├─ /podcast-edit ────────── synced multicam master, camera cuts, cut list
  │
  ├─ /podcast-transcript ──── speaker-labelled transcript, chapters, word timings
  │
  ├─ /youtube-description ─── title options, description, tags
  │
  ├─ /podcast-episode-page ── page for your own site (optional)
  │
  ├─ /thumbnail-brief ─────── chooses the hook and guest frame
  ├─ /thumbnail-generate ──── 1280x720 thumbnail PNG
  │
  ├─ /shorts ──────────────── 9:16 clips with typography and karaoke captions
  │
  ├─ /distribute ──────────── YouTube uploads, LinkedIn posts (optional), site highlights (optional)
  │
  └─ /podcast-guest-comms ─── review email, asset pack
        │
        └─ Guest approves, you flip it public
```

The full guide is in [`podcast/README.md`](podcast/README.md).

### Install

You need [Claude Code](https://claude.com/claude-code), Node 22 or later, Python 3 and ffmpeg.

```bash
git clone https://github.com/Addictivity/open-skills.git
cd open-skills/podcast

# Copy the skills. This overwrites any existing skills with the same names, so check first.
for s in podcast-transcript podcast-edit thumbnail-brief thumbnail-generate youtube-description \
         podcast-episode-page shorts distribute podcast-guest-comms; do
  cp -R "$s" ~/.claude/skills/
done

# Your settings
mkdir -p ~/.config/podcast-skills
cp config.example.json ~/.config/podcast-skills/config.json
```

Edit `~/.config/podcast-skills/config.json`, then follow the tool setup in [`podcast/README.md`](podcast/README.md).

### Costs and tools

Prices below come from each vendor's site in November 2026. They change, so check before relying on them.

| Tool | Used by | Cost |
|------|---------|------|
| Claude Code | everything | Needs a Claude plan or API usage |
| [AssemblyAI](https://www.assemblyai.com/pricing) | `/podcast-transcript` | Paid per hour of audio. About $0.20/hr at list prices for this setup, with free credit at signup |
| [Palmier Pro](https://palmier.io) | `/podcast-edit` | The editor and its MCP connection are free. Requires macOS 26 |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | `/shorts` | Free, Apache 2.0 |
| Google Chrome | `/thumbnail-generate` | Free |
| YouTube Data API | `/distribute` | Free within a daily quota, using your own Google Cloud project |
| A background remover | `/thumbnail-generate` | macOS Preview is free. remove.bg and image MCP tools are paid |
| [GoHighLevel](https://www.gohighlevel.com) | `/distribute`, optional | Paid subscription. Skip it and post from the paste pack |

### Status and testing

`podcast/tests/run-offline.sh` runs every script against made-up fixtures with no accounts or keys, and the shorts template and thumbnail have been rendered for real. The live calls to AssemblyAI, YouTube, GoHighLevel and Palmier need your own accounts, and this generalised copy has not been run against them. Try one episode at low stakes first.

### Provided as is

These skills come with no warranty and no support. Issues are turned off. They upload to real accounts and spend real money, so read what a script does before you run it, and keep `--dry-run` handy. Your API keys and tokens stay on your machine: the settings file holds paths, and the repo's `.gitignore` excludes the secrets themselves.

## Licence

MIT, copyright Addictivity. See [LICENSE](LICENSE). The bundled fonts keep their own licence, the SIL Open Font License, with the text beside each font.

## Credit

Made by [Addictivity](https://addictivity.com). If these save you time, a link back is appreciated.
