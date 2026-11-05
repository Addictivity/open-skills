#!/usr/bin/env node
// build-linkedin-drafts.js: LinkedIn captions and a posting schedule, one post per clip. Optional.
//
// Usage: node build-linkedin-drafts.js --episode-dir "/path/to/Episode N - Guest"
//          [--start-date YYYY-MM-DD] [--config path]
//
// Skips cleanly when publishing.linkedin.mode is "off". Otherwise reads clips.md and README.md
// and writes:
//   <ep>/distribute/linkedin-drafts.json     for push-linkedin-to-ghl.js and /podcast-guest-comms
//   <ep>/distribute/linkedin-paste-pack.md   everything needed to post by hand in LinkedIn
//
// Schedule comes from publishing.linkedin: post_days, post_time, timezone.
// Slots start on the first post day on or after --start-date (default: tomorrow).

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

if (require.main === module) main();

function main() {
  const args = lib.parseArgs(process.argv.slice(2));
  const EPISODE_DIR = lib.expandHome(args['episode-dir'] || args.e);
  if (!EPISODE_DIR) lib.fail('Usage: node build-linkedin-drafts.js --episode-dir "/path/to/Episode N - Guest" [--start-date YYYY-MM-DD]');

  const config = lib.loadConfig(args.config);
  const linkedin = (config.publishing || {}).linkedin || {};
  if ((linkedin.mode || 'paste-pack') === 'off') {
    console.log('publishing.linkedin.mode is "off", so there is nothing to do.');
    return;
  }

  const clipsPath = path.join(EPISODE_DIR, 'clips.md');
  if (!fs.existsSync(clipsPath)) lib.fail(`clips.md missing: ${clipsPath}`);
  const clipsMd = fs.readFileSync(clipsPath, 'utf8');
  const readme = lib.readIfExists(path.join(EPISODE_DIR, 'README.md'));
  const uploadsText = lib.readIfExists(path.join(EPISODE_DIR, 'distribute', 'youtube-uploads.json'));
  const fullYt = lib.readIfExists(path.join(EPISODE_DIR, 'youtube-description.md'));

  const meta = lib.parseEpisodeMeta(readme);
  const link = lib.episodeLink(config, meta, uploadsText ? JSON.parse(uploadsText) : null, fullYt + '\n' + readme);
  const clips = lib.parseClipSections(clipsMd);
  const order = lib.parsePostingOrder(clipsMd);
  if (order.length === 0) lib.fail('no "## Posting order" table with Clip N entries found in clips.md');

  const rendersDir = path.join(EPISODE_DIR, 'shorts', 'renders');
  const days = linkedin.post_days || ['Mon', 'Thu'];
  const time = linkedin.post_time || '14:00';
  const zone = linkedin.timezone || 'Europe/London';
  const start = args['start-date'] || isoDate(new Date(Date.now() + 86400000));
  const slots = generateSlots(start, order.length, days, time, zone);

  const drafts = [];
  order.forEach((entry, idx) => {
    const key = 'clip-' + entry.clipN;
    const clip = clips[key];
    if (!clip) { console.warn(`No clip section for ${key}, skipping`); return; }
    const mediaPath = lib.findRender(rendersDir, entry.clipN);
    if (!mediaPath) console.warn(`No render for ${key} yet. Build drafts after rendering, or the GHL push will skip it.`);
    drafts.push({
      clip: key,
      headline: clip.headline,
      scheduled_at: slots[idx].toISOString(),
      scheduled_label: formatDate(slots[idx], zone),
      posting_order: entry.position,
      text: buildPost(clip, link),
      media_path: mediaPath,
    });
  });

  const distDir = path.join(EPISODE_DIR, 'distribute');
  fs.mkdirSync(distDir, { recursive: true });
  const jsonPath = path.join(distDir, 'linkedin-drafts.json');
  fs.writeFileSync(jsonPath, JSON.stringify(drafts, null, 2));
  const packPath = path.join(distDir, 'linkedin-paste-pack.md');
  fs.writeFileSync(packPath, buildPastePack(drafts, meta, config, zone));

  console.log(`Wrote ${drafts.length} draft(s) to ${jsonPath}`);
  console.log(`Wrote paste pack to ${packPath}\n`);
  console.log('Schedule:');
  for (const d of drafts) console.log(`  ${d.scheduled_label.padEnd(30)} ${d.clip}: ${d.headline}`);
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// UTC instant for a wall-clock time in a time zone, so posts hold their local time across clock changes.
function zonedToUtc(dateStr, timeStr, zone) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(guess);
  const get = t => parseInt(parts.find(p => p.type === t).value, 10);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

function generateSlots(startDate, count, days, time, zone) {
  const wanted = new Set(days);
  if (![...wanted].every(d => DAY_NAMES.includes(d))) lib.fail(`post_days must use ${DAY_NAMES.join(', ')}`);
  const slots = [];
  const cursor = new Date(startDate + 'T12:00:00Z');
  while (slots.length < count) {
    if (wanted.has(DAY_NAMES[cursor.getUTCDay()])) slots.push(zonedToUtc(isoDate(cursor), time, zone));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return slots;
}

function formatDate(d, zone) {
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: zone });
}

function buildPost(clip, link) {
  // Rules: no emoji, one link only, and the hook leads the post.
  let text = clip.caption || '';
  if (clip.hook && !text.trimStart().startsWith(clip.hook.slice(0, 30))) {
    text = clip.hook.trim() + '\n\n' + text;
  }
  text = text.replace(/\s*link in comments\.?/gi, '');
  if (link && !text.includes(link)) text = text.trim() + `\n\nFull episode: ${link}`;
  text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}]/gu, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function buildPastePack(drafts, meta, config, zone) {
  const who = [meta.guest, meta.guestCompany].filter(Boolean).join(' and ') || 'the guest and their company';
  const lines = [
    `# Episode ${meta.episode || '?'} ${meta.guest || ''}: LinkedIn paste pack`.trim(),
    '',
    `${drafts.length} posts. Times are ${zone}. Scheduling natively in LinkedIn means you can @mention people, which API routes often cannot do reliably.`,
    '',
    '**Wait for the guest to approve the episode before you schedule these.** A post scheduled on LinkedIn goes out by itself.',
    '',
    '## How to post each one',
    '',
    '1. On LinkedIn, start a post and add the video named below.',
    `2. Paste the caption. Where it names ${who}, delete the plain name, type @ and pick the real page.`,
    '3. Click the clock icon and set the date and time below.',
    '4. Tick the box.',
    '',
  ];
  drafts.forEach((d, i) => {
    lines.push(
      `## Post ${i + 1}: ${d.scheduled_label}`,
      '',
      `- [ ] Scheduled`,
      `- File: \`${d.media_path ? path.basename(d.media_path) : `${d.clip}-final.mp4 (not rendered yet)`}\``,
      `- Tag: ${who}`,
      '',
      '```',
      d.text,
      '```',
      '',
    );
  });
  return lines.join('\n');
}

module.exports = { zonedToUtc, generateSlots, buildPost };
