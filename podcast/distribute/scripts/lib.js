// lib.js: shared helpers for the distribute scripts.

const fs = require('fs');
const os = require('os');
const path = require('path');

function fail(message) {
  console.error('Error: ' + message);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else { out[key] = true; }
    } else if (a.startsWith('-') && a.length === 2) {
      out[a.slice(1)] = argv[++i];
    }
  }
  return out;
}

function expandHome(p) {
  return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function loadConfig(explicit) {
  const p = expandHome(explicit || process.env.PODCAST_CONFIG || '~/.config/podcast-skills/config.json');
  if (!fs.existsSync(p)) fail(`settings file not found: ${p}\nCopy podcast/config.example.json there and fill it in, or pass --config.`);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`${p} is not valid JSON: ${e.message}`);
  }
}

function loadEnv(file) {
  const env = { ...process.env };
  if (file && fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function slugify(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function parseEpisodeMeta(readme) {
  const meta = {};
  const field = name => {
    const m = readme.match(new RegExp('^' + name + ':[ \\t]*([^\\n]+)', 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  const ep = field('episode');
  if (ep && /^\d+$/.test(ep)) meta.episode = parseInt(ep, 10);
  meta.guest = field('guest');
  meta.guestCompany = field('guest_company');
  if (meta.episode && meta.guest) meta.slug = slugify(`episode-${meta.episode}-${meta.guest}`);
  return meta;
}

// The one link for posts and descriptions: the episode page if there is a site, otherwise YouTube.
function episodeLink(config, meta, uploads, texts) {
  const site = config.site || {};
  if (site.enabled && site.base_url && meta.slug) {
    return site.base_url.replace(/\/$/, '') + (site.episode_path || '/podcast/{slug}').replace('{slug}', meta.slug);
  }
  if (uploads && uploads.episode && uploads.episode.url) return uploads.episode.url;
  const yt = (texts || '').match(/https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/);
  return yt ? yt[0] : '';
}

function extractBlockField(block, label) {
  // Matches `**Label (...):**` followed by > quote lines or a single line. Empty > lines stay
  // as paragraph breaks.
  const re = new RegExp('\\*\\*' + label + '[^*]*?:\\*\\*\\s*\\n((?:>\\s*.*\\n?)+|.*?)(?=\\n\\*\\*|$)', 'i');
  const m = block.match(re);
  if (!m) return '';
  return m[1]
    .split('\n')
    .map(l => l.replace(/^>\s?/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(/^["'`]|["'`]$/g, '');
}

function parseClipSections(md) {
  const sections = {};
  const re = /^##\s*Clip\s*(\d+)\s*[\u2014\u2013-]\s*([^\n]+?)\s*$/gmi;
  const heads = [];
  let m;
  while ((m = re.exec(md))) {
    heads.push({ n: parseInt(m[1], 10), title: m[2].trim().replace(/^["'`]|["'`]$/g, ''), start: m.index });
  }
  heads.forEach((cur, i) => {
    let block = md.slice(cur.start, heads[i + 1] ? heads[i + 1].start : md.length);
    const nextSection = block.indexOf('\n## ', 1);
    if (nextSection > 0) block = block.slice(0, nextSection); // stop at ## Posting order and the like
    sections['clip-' + cur.n] = {
      n: cur.n,
      headline: cur.title,
      pullQuote: extractBlockField(block, 'Pull quote'),
      hook: extractBlockField(block, 'LinkedIn hook'),
      caption: extractBlockField(block, 'LinkedIn caption'),
    };
  });
  return sections;
}

function parsePostingOrder(md) {
  const m = md.match(/##\s*Posting order[\s\S]*?(?=\n## |$)/i);
  if (!m) return [];
  const out = [];
  for (const row of m[0].split('\n').filter(l => l.trim().startsWith('|'))) {
    const cells = row.split('|').map(c => c.trim());
    const clip = cells.slice(1).map(c => c.match(/^Clip\s*(\d+)/i)).find(Boolean);
    if (clip) out.push({ position: cells[1], clipN: parseInt(clip[1], 10) });
  }
  return out;
}

function findRender(rendersDir, clipN) {
  if (!fs.existsSync(rendersDir)) return null;
  const hit = fs.readdirSync(rendersDir).find(f => new RegExp(`^clip-${clipN}(-.*)?-final\\.mp4$`, 'i').test(f));
  return hit ? path.join(rendersDir, hit) : null;
}

module.exports = {
  fail, parseArgs, expandHome, loadConfig, loadEnv, readIfExists, slugify,
  parseEpisodeMeta, episodeLink, extractBlockField, parseClipSections, parsePostingOrder, findRender,
};
