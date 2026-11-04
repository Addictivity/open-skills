#!/usr/bin/env node
// build-youtube-metadata.js: title, description and tags for each YouTube Short.
//
// Usage: node build-youtube-metadata.js --episode-dir "/path/to/Episode N - Guest" [--config path]
//
// Reads clips.md, youtube-description.md and README.md from the episode folder.
// Writes <episode-dir>/distribute/youtube-metadata.json: { clip-N: { title, description, tags } }

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

if (require.main === module) main();

function main() {
  const args = lib.parseArgs(process.argv.slice(2));
  const EPISODE_DIR = args['episode-dir'] || args.e;
  if (!EPISODE_DIR) lib.fail('Usage: node build-youtube-metadata.js --episode-dir "/path/to/Episode N - Guest"');

  const config = lib.loadConfig(args.config);
  const clipsPath = path.join(EPISODE_DIR, 'clips.md');
  if (!fs.existsSync(clipsPath)) lib.fail(`clips.md missing: ${clipsPath}`);
  const clipsMd = fs.readFileSync(clipsPath, 'utf8');
  const fullYt = lib.readIfExists(path.join(EPISODE_DIR, 'youtube-description.md'));
  const readme = lib.readIfExists(path.join(EPISODE_DIR, 'README.md'));
  const uploadsText = lib.readIfExists(path.join(EPISODE_DIR, 'distribute', 'youtube-uploads.json'));

  const meta = lib.parseEpisodeMeta(readme);
  const link = lib.episodeLink(config, meta, uploadsText ? JSON.parse(uploadsText) : null, fullYt + '\n' + readme);
  const baseTags = extractBaseTags(fullYt);
  const clips = lib.parseClipSections(clipsMd);
  if (Object.keys(clips).length === 0) lib.fail('no "## Clip N - Title" sections found in clips.md');

  const out = {};
  for (const [key, clip] of Object.entries(clips)) {
    out[key] = {
      title: buildTitle(clip),
      description: buildDescription(clip, link, meta, config),
      tags: buildTags(clip, baseTags, config),
      pull_quote: clip.pullQuote,
    };
  }

  const distDir = path.join(EPISODE_DIR, 'distribute');
  fs.mkdirSync(distDir, { recursive: true });
  const outPath = path.join(distDir, 'youtube-metadata.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${Object.keys(out).length} clip metadata entries to ${outPath}`);
  if (!link) console.log('Note: no episode link found. Upload the episode or turn the site on, then re-run so the descriptions carry it.');
}

function extractBaseTags(youtube) {
  // /youtube-description writes a "## Tags" section, usually a fenced comma list.
  const m = youtube.match(/##\s*Tags[^\n]*\n+([\s\S]*?)(?=\n## |\n---|$)/i);
  if (!m) return [];
  return m[1]
    .replace(/```/g, '')
    .split(/[,\n]/)
    .map(t => t.replace(/^[-*\s#]+|[\s.]+$/g, '').trim())
    .filter(t => t.length >= 2 && t.length <= 40);
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026';
}

function buildTitle(clip) {
  // YouTube caps titles at 100 characters. The hook is already shaped as a first line.
  return truncate((clip.hook || clip.headline || '').trim(), 100);
}

function buildDescription(clip, link, meta, config) {
  const show = config.show || {};
  const yt = (config.publishing || {}).youtube || {};
  const lines = [];
  if (clip.caption) {
    // Strip LinkedIn conventions that do not fit YouTube.
    lines.push(clip.caption.replace(/\s*link in comments\.?/gi, '').replace(/\n{3,}/g, '\n\n').trim(), '');
  } else if (clip.pullQuote) {
    lines.push('"' + clip.pullQuote + '"', '');
  }
  lines.push('---');
  if (link) lines.push('🎙 Watch the full conversation:', link, '');
  if (meta.guest) lines.push(`Guest: ${meta.guest}`);
  if (show.host) lines.push(`Host: ${show.host}`);
  lines.push('', [yt.short_hashtags || '#Shorts', show.hashtag].filter(Boolean).join(' '));
  return lines.join('\n');
}

function buildTags(clip, baseTags, config) {
  // Shorts, the show's tags, words from the clip headline, then the episode's tags.
  const specific = (clip.headline || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 4);
  const showName = (config.show || {}).name;
  const configured = ((config.publishing || {}).youtube || {}).tags || [];
  const seen = new Set();
  const tags = [];
  for (const t of ['Shorts', showName, showName && showName + ' Podcast', ...configured, ...specific, ...baseTags]) {
    const k = (t || '').toLowerCase().trim();
    if (k && !seen.has(k)) { seen.add(k); tags.push(t.trim()); }
  }
  // YouTube caps tags at 500 characters in total. Commas count, so stop early.
  const kept = [];
  let total = 0;
  for (const t of tags) {
    if (total + t.length + 1 > 480) break;
    kept.push(t);
    total += t.length + 1;
  }
  return kept;
}

module.exports = { extractBaseTags, buildTitle, buildDescription, buildTags };
