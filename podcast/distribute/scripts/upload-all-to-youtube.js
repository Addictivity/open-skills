#!/usr/bin/env node
// upload-all-to-youtube.js: upload an episode's shorts, then optionally the full episode.
//
// Usage:
//   node upload-all-to-youtube.js --episode-dir "/path/to/Episode N - Guest"
//     [--privacy unlisted|public|private]   default: publishing.youtube.privacy
//     [--episode-video /path/to/master.mp4] also upload the full episode, after the clips
//     [--python /path/to/python]            default: ../.venv/bin/python, then python3
//     [--dry-run] [--config path]
//
// Reads:  <ep>/distribute/youtube-metadata.json, <ep>/shorts/renders/clip-N-final.mp4
//         With --episode-video: <ep>/distribute/episode-title.txt, episode-description.txt, episode-tags.txt
// Writes: <ep>/distribute/youtube-uploads.json (clips already recorded there are skipped)
//
// Clips go first on purpose. If the OAuth login picked the wrong channel, you lose one small
// clip to the channel guard, not a multi-gigabyte episode upload.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const lib = require('./lib');

const args = lib.parseArgs(process.argv.slice(2));
const EP_DIR = args['episode-dir'] || args.e;
if (!EP_DIR) lib.fail('Usage: node upload-all-to-youtube.js --episode-dir "/path/to/Episode N - Guest" [--privacy unlisted] [--episode-video master.mp4] [--dry-run]');

const config = lib.loadConfig(args.config);
const yt = (config.publishing || {}).youtube || {};
if (yt.enabled === false) lib.fail('publishing.youtube.enabled is false in the settings file.');

const DRY_RUN = !!args['dry-run'];
const PRIVACY = args.privacy || yt.privacy || 'unlisted';
const paths = config.paths || {};
const CREDS = lib.expandHome(paths.google_client_secret || '~/.config/podcast-skills/youtube-client-secret.json');
const TOKEN = path.join(lib.expandHome(paths.tokens_dir || '~/.config/podcast-skills/tokens'), 'youtube-upload-token.json');
const distDir = path.join(EP_DIR, 'distribute');
const METADATA = path.join(distDir, 'youtube-metadata.json');
const OUT = path.join(distDir, 'youtube-uploads.json');
const RENDERS = path.join(EP_DIR, 'shorts', 'renders');
const SCRIPT = path.join(__dirname, 'youtube-upload.py');

if (!fs.existsSync(METADATA)) lib.fail(`${METADATA} missing. Run build-youtube-metadata.js first.`);
if (!fs.existsSync(CREDS) && !fs.existsSync(TOKEN) && !DRY_RUN) lib.fail(`Google OAuth client file missing: ${CREDS}. See the setup section in SKILL.md.`);

const venvPython = path.join(__dirname, '..', '.venv', 'bin', 'python');
const PYTHON = args.python || (fs.existsSync(venvPython) ? venvPython : 'python3');

const metadata = JSON.parse(fs.readFileSync(METADATA, 'utf8'));
const uploads = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
let failures = 0;

function upload(key, video, title, description, tags, extra = []) {
  console.log(`\n${key}: ${title}`);
  if (DRY_RUN) {
    console.log(`  would upload ${video} as ${PRIVACY}, ${tags.length} tags, ${description.length} character description`);
    return;
  }
  const res = spawnSync(PYTHON, [SCRIPT,
    '--video', video, '--title', title, '--description', description, '--tags', tags.join(','),
    '--credentials', CREDS, '--token-store', TOKEN, '--privacy', PRIVACY,
    '--category', String(yt.category_id || '22'), ...extra,
  ], { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8' });
  if (res.status !== 0 || !res.stdout) {
    console.error(`  FAILED: see the message above`);
    failures++;
    return;
  }
  const result = JSON.parse(res.stdout);
  uploads[key] = result;
  fs.writeFileSync(OUT, JSON.stringify(uploads, null, 2));
  console.log(`  ok ${result.url}`);

  // The account chooser's names and avatars can mislead. Only the channel ID proves it.
  if (yt.channel_id && result.channel_id !== yt.channel_id) {
    lib.fail(`wrong channel. This upload landed on ${result.channel_id} (${result.channel}), expected ${yt.channel_id}.
Stopping now. Delete ${result.url} in YouTube Studio, delete ${TOKEN}, and sign in again choosing the right channel.`);
  }
}

const clipKeys = Object.keys(metadata).sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
for (const key of clipKeys) {
  if (uploads[key]) {
    console.log(`${key}: already uploaded (${uploads[key].url}), skipping`);
    continue;
  }
  const video = lib.findRender(RENDERS, key.replace('clip-', ''));
  if (!video) {
    console.error(`${key}: no rendered MP4 in ${RENDERS} (looking for ${key}-final.mp4)`);
    failures++;
    continue;
  }
  const m = metadata[key];
  upload(key, video, m.title, m.description, m.tags || []);
}

if (args['episode-video']) {
  if (uploads.episode) {
    console.log(`episode: already uploaded (${uploads.episode.url}), skipping`);
  } else {
    const read = name => {
      const p = path.join(distDir, name);
      if (!fs.existsSync(p)) lib.fail(`${p} missing. Copy each chosen field from youtube-description.md first.`);
      return fs.readFileSync(p, 'utf8').trim();
    };
    if (!fs.existsSync(args['episode-video'])) lib.fail(`episode video not found: ${args['episode-video']}`);
    upload('episode', args['episode-video'], read('episode-title.txt'), read('episode-description.txt'),
      read('episode-tags.txt').split(',').map(t => t.trim()).filter(Boolean), ['--full-episode']);
  }
}

console.log('\n=== Summary ===');
for (const [k, v] of Object.entries(uploads)) console.log(`  ${k.padEnd(10)} ${v.url}  (${v.privacy})`);
console.log(`\nOutput: ${OUT}`);
if (!DRY_RUN) console.log(`Next: review in YouTube Studio (currently ${PRIVACY}). Nothing goes public until the guest approves.`);
process.exit(failures ? 1 : 0);
