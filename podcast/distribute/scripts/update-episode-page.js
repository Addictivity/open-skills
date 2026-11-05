#!/usr/bin/env node
// update-episode-page.js: optional. Add a Highlights section of Shorts to your episode page.
//
// Usage:
//   node update-episode-page.js --episode-dir "/path/to/Episode N - Guest"
//     [--write] [--include-unpublished] [--config path]
//
// Reads distribute/youtube-uploads.json, distribute/youtube-metadata.json and the slug from
// episode-page.md (or README.md). Always writes distribute/highlights.json, which you can feed
// to any site. With --write, also patches the markdown or MDX file at site.repo + site.episode_file.
//
// Skips cleanly when site.enabled is false. It never commits or pushes. Check the diff yourself,
// because on most sites a push is a deploy, and the guest-approval gate in SKILL.md applies.
//
// Only clips viewers can already see are included. A scheduled Short is private until it
// publishes, has no thumbnail at any size, and renders as a dead tile.

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

if (require.main === module) main();

function main() {
  const args = lib.parseArgs(process.argv.slice(2));
  const EP_DIR = lib.expandHome(args['episode-dir'] || args.e);
  if (!EP_DIR) lib.fail('Usage: node update-episode-page.js --episode-dir "/path/to/Episode N - Guest" [--write]');

  const config = lib.loadConfig(args.config);
  const site = config.site || {};
  if (!site.enabled) {
    console.log('site.enabled is false in the settings file, so there is nothing to do.');
    return;
  }

  const uploadsPath = path.join(EP_DIR, 'distribute', 'youtube-uploads.json');
  if (!fs.existsSync(uploadsPath)) lib.fail(`${uploadsPath} missing. Upload the clips first.`);
  const uploads = JSON.parse(fs.readFileSync(uploadsPath, 'utf8'));
  const metadata = JSON.parse(lib.readIfExists(path.join(EP_DIR, 'distribute', 'youtube-metadata.json')) || '{}');

  const pageMd = lib.readIfExists(path.join(EP_DIR, 'episode-page.md'));
  const slugMatch = pageMd.match(/^slug:\s*(.+?)\s*$/m);
  const slug = slugMatch ? slugMatch[1] : lib.parseEpisodeMeta(lib.readIfExists(path.join(EP_DIR, 'README.md'))).slug;
  if (!slug) lib.fail('no slug found in episode-page.md or README.md');

  const highlights = selectHighlights(uploads, metadata, !!args['include-unpublished'], new Date());
  const skipped = Object.keys(uploads).filter(k => k.startsWith('clip-')).length - highlights.length;
  const outPath = path.join(EP_DIR, 'distribute', 'highlights.json');
  fs.writeFileSync(outPath, JSON.stringify(highlights, null, 2));
  console.log(`Wrote ${highlights.length} highlight(s) to ${outPath}${skipped ? ` (${skipped} still private, left out)` : ''}`);

  if (!args.write) {
    console.log('Pass --write to patch the page file, or use highlights.json in your site code.');
    return;
  }
  if (!site.repo || !site.episode_file) lib.fail('set site.repo and site.episode_file in the settings file to use --write.');
  const targetPath = path.join(lib.expandHome(site.repo), site.episode_file.replace('{slug}', slug));
  if (!fs.existsSync(targetPath)) lib.fail(`episode page not found: ${targetPath}`);

  const block = buildBlock(highlights, site.short_embed || '<YouTubeShort id="{id}" />');
  fs.writeFileSync(targetPath, patchPage(fs.readFileSync(targetPath, 'utf8'), block));
  console.log(`Patched ${targetPath}`);
  console.log(`Review it with: git -C "${lib.expandHome(site.repo)}" diff`);
}

function selectHighlights(uploads, metadata, includeUnpublished, now) {
  return Object.keys(uploads)
    .filter(k => k.startsWith('clip-'))
    .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))
    .filter(k => {
      const u = uploads[k];
      const published = u.privacy !== 'private' || (u.publish_at && new Date(u.publish_at) <= now);
      return includeUnpublished || published;
    })
    .map(k => ({ id: uploads[k].video_id, title: (metadata[k] || {}).title || uploads[k].title || k }));
}

function buildBlock(highlights, embed) {
  const items = highlights.map(h => `### ${h.title}\n\n${embed.replace('{id}', h.id)}\n`).join('\n');
  return `## Highlights\n\nShort cuts from the episode.\n\n${items}`;
}

function patchPage(page, block) {
  // Replace an existing Highlights section, else insert after Watch the Episode, else append.
  // Replacement functions, because a title containing $ would otherwise be read as a pattern.
  if (/^##\s+Highlights\b/m.test(page)) {
    return page.replace(/^##\s+Highlights\b[\s\S]*?(?=\n## |$(?![\s\S]))/m, () => block.trim() + '\n');
  }
  if (/^##\s+Watch the Episode\b[\s\S]*?\n## /m.test(page)) {
    return page.replace(/(^##\s+Watch the Episode[\s\S]*?\n)(## )/m, (whole, a, b) => a + block + '\n' + b);
  }
  return page.trim() + '\n\n' + block + '\n';
}

module.exports = { selectHighlights, buildBlock, patchPage };
