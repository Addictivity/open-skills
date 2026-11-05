#!/usr/bin/env node
// push-linkedin-to-ghl.js: optional. Push LinkedIn drafts to GoHighLevel Social Planner.
// You need this only if you use GoHighLevel. Without it, use linkedin-paste-pack.md.
//
// Usage:
//   node push-linkedin-to-ghl.js --episode-dir "/path/to/Episode N - Guest"
//     [--status draft|scheduled] [--dry-run] [--env /path/to/.env] [--config path]
//
// Needs publishing.linkedin.mode set to "ghl", plus GHL_PRIVATE_TOKEN and GHL_LOCATION_ID
// in the environment or in paths.env_file. Token scopes: social-media-posting read and write,
// medias read and write, locations read.
//
// Reads:  <episode-dir>/distribute/linkedin-drafts.json
// Writes: <episode-dir>/distribute/ghl-posts.json
//
// For each draft: upload the MP4 to the GHL media library, then create a post.
// Status defaults to draft, so nothing goes out until you approve it in GHL.

const fs = require('fs');
const path = require('path');
const https = require('https');
const lib = require('./lib');

const GHL_API = 'https://services.leadconnectorhq.com';

const args = lib.parseArgs(process.argv.slice(2));
const EP_DIR = lib.expandHome(args['episode-dir'] || args.e);
if (!EP_DIR) lib.fail('Usage: node push-linkedin-to-ghl.js --episode-dir "/path/to/Episode N - Guest" [--status draft|scheduled] [--dry-run]');

const config = lib.loadConfig(args.config);
const linkedin = (config.publishing || {}).linkedin || {};
if (linkedin.mode !== 'ghl') {
  console.log(`publishing.linkedin.mode is "${linkedin.mode || 'paste-pack'}", not "ghl", so there is nothing to push. Use distribute/linkedin-paste-pack.md.`);
  process.exit(0);
}

const STATUS = args.status || 'draft';
if (!['draft', 'scheduled'].includes(STATUS)) lib.fail('--status must be draft or scheduled');
const DRY_RUN = !!args['dry-run'];

const draftsPath = path.join(EP_DIR, 'distribute', 'linkedin-drafts.json');
if (!fs.existsSync(draftsPath)) lib.fail(`${draftsPath} missing. Run build-linkedin-drafts.js first.`);
const drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));

const env = lib.loadEnv(lib.expandHome(args.env || (config.paths || {}).env_file));
const TOKEN = env.GHL_PRIVATE_TOKEN;
const LOC_ID = env.GHL_LOCATION_ID;
if (!DRY_RUN) {
  if (!TOKEN) lib.fail('GHL_PRIVATE_TOKEN not found in the environment or env file.');
  if (!LOC_ID) lib.fail('GHL_LOCATION_ID not found in the environment or env file.');
}

const HEADERS = { Authorization: `Bearer ${TOKEN}`, Version: '2021-07-28', Accept: 'application/json' };

if (DRY_RUN) {
  console.log(`Dry run: would push ${drafts.length} draft(s) to GHL with status "${STATUS}".`);
  for (const d of drafts) {
    const ok = d.media_path && fs.existsSync(d.media_path);
    console.log(`  ${d.clip} at ${d.scheduled_label || d.scheduled_at}: ${ok ? d.media_path : 'MEDIA MISSING, would skip'}`);
  }
  process.exit(0);
}

(async () => {
  console.log(`Pushing ${drafts.length} draft(s) to GHL Social Planner (${STATUS})\n`);

  const response = await ghl(`/social-media-posting/${LOC_ID}/accounts`, 'GET');
  const accounts = response.results?.accounts || response.accounts || [];
  const profiles = accounts.filter(a => a.platform === 'linkedin');
  const match = (linkedin.account_name_match || '').toLowerCase();
  const account = (match && profiles.find(a => (a.name || '').toLowerCase().includes(match)))
    || profiles.find(a => a.type === 'profile')
    || profiles[0];

  if (!account) {
    console.error('No LinkedIn account connected to this location. Connected accounts:');
    accounts.forEach(a => console.error(`  ${a.platform}/${a.type}: ${a.name} (${a.id})`));
    process.exit(1);
  }
  console.log(`Using: ${account.name} (LinkedIn ${account.type}) ${account.id}\n`);

  const result = {};
  let failures = 0;
  for (const draft of drafts) {
    console.log(`-> ${draft.clip} (${draft.scheduled_label || draft.scheduled_at})`);

    if (!draft.media_path || !fs.existsSync(draft.media_path)) {
      console.error(`  x media file missing: ${draft.media_path}`);
      failures++;
      continue;
    }

    try {
      const mediaUrl = await uploadMedia(draft.media_path);
      console.log(`  ok media uploaded: ${mediaUrl}`);
      // GHL needs both accountIds and userId, and userId is the account's oauthId.
      const created = await ghl(`/social-media-posting/${LOC_ID}/posts`, 'POST', {
        accountIds: [account.id],
        userId: account.oauthId,
        summary: draft.text,
        type: 'post',
        status: STATUS,
        scheduleDate: draft.scheduled_at,
        media: [{ url: mediaUrl, type: 'video' }],
      });
      // The response sometimes has no clear id. Check Social Planner if this prints undefined.
      const postId = created.id || created.postId || created._id;
      console.log(`  ok post created: ${postId}`);
      result[draft.clip] = { post_id: postId, scheduled_at: draft.scheduled_at, status: STATUS, media_url: mediaUrl };
    } catch (e) {
      console.error(`  x failed: ${e.message}`);
      failures++;
    }
  }

  const outPath = path.join(EP_DIR, 'distribute', 'ghl-posts.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${Object.keys(result).length} post record(s) to ${outPath}`);
  console.log('Next: review the drafts in Social Planner and approve them.');
  process.exit(failures ? 1 : 0);
})().catch(e => lib.fail(e.message));


function request(url, opts, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}, raw: ${data.slice(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function ghl(pathSpec, method, body) {
  return request(new URL(GHL_API + pathSpec), { method, headers: { ...HEADERS, 'Content-Type': 'application/json' } }, body ? JSON.stringify(body) : null);
}

async function uploadMedia(filePath) {
  const boundary = '----' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"\r\n` +
    `Content-Type: video/mp4\r\n\r\n`
  );
  const payload = Buffer.concat([head, fs.readFileSync(filePath), Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const json = await request(new URL(GHL_API + '/medias/upload-file'), {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': payload.length },
  }, payload);
  const url = json.url || json.fileUrl || json.location || json.path;
  if (!url) throw new Error(`no media URL in response: ${JSON.stringify(json).slice(0, 300)}`);
  return url;
}
