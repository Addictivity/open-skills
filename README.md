# Open Skills

Claude Code skills you can use as they are, or change to suit how you work. They come from [Addictivity](https://addictivity.com), and the first release is a pack for producing a video podcast.

## The podcast pack

Nine skills that take an interview podcast from raw recording to published episode and shorts. Addictivity built them to produce its own show, then stripped out everything specific to that show. Your show's name, brand, paths and publishing targets all live in one settings file.

It suits someone who records long-form interviews, is comfortable in a terminal, and would rather direct Claude Code than click through an editor for every episode. Expect some setup: there are API keys to add.

**The multicam edit needs [Palmier Pro](https://palmier.io),** a Mac editor that requires macOS 26. `/podcast-edit` drives it directly and won't work without it. If you don't use Palmier, edit elsewhere and start at `/podcast-transcript`, or change the skill to suit your editor.

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

You need [Claude Code](https://claude.com/claude-code), Node 22 or later, Python 3 and ffmpeg. Thumbnails also need Google Chrome.

```bash
git clone https://github.com/Addictivity/open-skills.git
cd open-skills/podcast

# Copy the skills. This overwrites any existing skills with the same names, so check first.
mkdir -p ~/.claude/skills
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

### What has and hasn't been tested

**Tested:** the install steps from a fresh clone, on a Mac. An offline test script runs every script with no accounts or keys (`podcast/tests/run-offline.sh`). A thumbnail and a short were rendered for real from made-up footage, with HyperFrames 0.9.16.

**Not tested in this copy:**

- Live AssemblyAI. The request follows AssemblyAI's documentation but has never been sent. If it rejects the default model, try `--model universal-3-5-pro`.
- Live YouTube, including the Google Cloud setup and sign-in. Those steps come from Google's documentation and haven't been run end to end.
- GoHighLevel.
- Palmier. Only `/podcast-edit`'s three cut-list scripts have run. The rest of the skill has never driven the app from this copy.

So try your first episode at low stakes, and expect to fix something along the way.

### Provided as is

These skills come with no warranty and no support. Issues are turned off. They upload to real accounts and spend real money, so read what a script does before you run it, and keep `--dry-run` handy. Your API keys and tokens stay on your machine: the settings file holds paths, and the repo's `.gitignore` excludes the secrets themselves.

## Licence

MIT, copyright Addictivity. See [LICENSE](LICENSE). The bundled fonts keep their own licence, the SIL Open Font License, with the text beside each font.

## Credit

Made by [Addictivity](https://addictivity.com). If these save you time, a link back is appreciated.
