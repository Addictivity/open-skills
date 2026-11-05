#!/usr/bin/env node
// build-compositions.js: scaffold per-clip HyperFrames compositions from the template.
//
// Usage: node build-compositions.js --episode-dir "/path/to/Episode N - Guest"
//   --clips-spec   override path to clips.md (default: <episode-dir>/clips.md)
//   --template     override path to template (default: ../template/index.html)
//   --config       settings file (default: $PODCAST_CONFIG, then ~/.config/podcast-skills/config.json)
//   --skip-fade    no fade to black at the end
//
// For each file in <episode-dir>/shorts/raw/, this script:
//   1. Reads the matching transcript from <shorts>/transcripts/<clip-slug>.json
//   2. Resolves duration via ffprobe
//   3. Parses beats from clips.md (the per-clip "On-screen text" sections)
//   4. Writes composition-N/index.html from the template, with brand colours and fonts
//   5. Copies the clip into composition-N/clip.mov (a copy-on-write clone where the disk allows it)
//
// The clip number comes from the filename (clip-3.mp4, CLIP 3.mov). Files with no number
// take their position in sorted order.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const DISPLAY_SECONDS = 3.8; // a beat lives about this long: 0.9s in, hold, 0.9s out
const FADE_SECONDS = 0.6;
const MAX_ACCENT_CHARS = 28; // the accent is a fixed 78px with no auto-fit

if (require.main === module) main();

function main() {
  const args = parseArgs(process.argv.slice(2));
  const EPISODE_DIR = args['episode-dir'] ? expandHome(args['episode-dir']) : args.e;
  if (!EPISODE_DIR) {
    console.error('Usage: node build-compositions.js --episode-dir "/path/to/Episode N - Guest"');
    process.exit(1);
  }

  try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); }
  catch { fail('ffprobe not found. It comes with ffmpeg, so install that first (on a Mac: brew install ffmpeg).'); }

  const config = loadConfig(args.config);
  const SHORTS_DIR = path.join(EPISODE_DIR, 'shorts');
  const RAW_DIR = path.join(SHORTS_DIR, 'raw');
  const TRANSCRIPTS_DIR = path.join(SHORTS_DIR, 'transcripts');
  const CLIPS_SPEC = args['clips-spec'] || path.join(EPISODE_DIR, 'clips.md');
  const TEMPLATE = args.template || path.join(__dirname, '..', 'template', 'index.html');

  for (const [label, p] of [['Raw dir', RAW_DIR], ['Transcripts dir (run transcribe-clips.sh first)', TRANSCRIPTS_DIR], ['clips.md', CLIPS_SPEC], ['Template', TEMPLATE]]) {
    if (!fs.existsSync(p)) fail(`${label} missing: ${p}`);
  }

  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const clipsMd = fs.readFileSync(CLIPS_SPEC, 'utf8');
  const brand = config.brand || {};
  const colours = brand.colours || {};
  const fonts = {
    accent: (brand.fonts || {}).short_accent || 'DM Sans',
    main: (brand.fonts || {}).short_main || 'Gelasio',
    caption: (brand.fonts || {}).short_caption || 'DM Sans',
  };
  const fontFiles = resolveFonts(Object.values(fonts), brand.font_files || {}, path.join(path.dirname(TEMPLATE), 'fonts'));

  const rawFiles = fs.readdirSync(RAW_DIR)
    .filter(f => /\.(mov|mp4)$/i.test(f) && fs.statSync(path.join(RAW_DIR, f)).isFile())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  if (rawFiles.length === 0) fail(`No .mov or .mp4 found in ${RAW_DIR}`);

  console.log(`Building ${rawFiles.length} composition(s) from ${rawFiles.join(', ')}\n`);

  rawFiles.forEach((filename, idx) => {
    const compN = clipNumber(filename) || idx + 1;
    const slug = filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, '-');
    const transcriptPath = path.join(TRANSCRIPTS_DIR, slug + '.json');
    if (!fs.existsSync(transcriptPath)) {
      console.error(`  x composition-${compN} (${filename}): transcript missing at ${transcriptPath}`);
      process.exitCode = 1;
      return;
    }

    const compDir = path.join(SHORTS_DIR, 'composition-' + compN);
    fs.mkdirSync(path.join(compDir, 'fonts'), { recursive: true });

    // An existing clip.mov is kept, so delete the composition folder after re-cutting a raw clip.
    const compClip = path.join(compDir, 'clip.mov');
    if (!fs.existsSync(compClip)) {
      fs.copyFileSync(path.join(RAW_DIR, filename), compClip, fs.constants.COPYFILE_FICLONE);
    }
    for (const f of fontFiles) fs.copyFileSync(f.source, path.join(compDir, 'fonts', f.fileName));

    const duration = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', compClip]).toString().trim());
    const words = applyGlossary(JSON.parse(fs.readFileSync(transcriptPath, 'utf8')), config.glossary || {});
    const beats = parseBeatsForClip(clipsMd, compN, duration, words);

    const values = {
      COMP_ID: 'clip-' + compN,
      DURATION: duration.toFixed(2),
      FADE_DUR: args['skip-fade'] ? '0' : String(FADE_SECONDS),
      BEATS_JSON: JSON.stringify(beats),
      WORDS_JSON: JSON.stringify(words),
      FONT_FACES: fontFiles.map(f => `@font-face { font-family: '${f.family}'; src: url('fonts/${f.fileName}') format('truetype-variations'); font-weight: 100 1000; font-style: normal; }`).join('\n    '),
      FONT_ACCENT: fonts.accent,
      FONT_MAIN: fonts.main,
      FONT_CAPTION: fonts.caption,
      COLOUR_ACCENT: colours.short_accent || '#D4D4D4',
      COLOUR_MAIN: colours.short_main || '#FFFFFF',
      COLOUR_CAPTION_FUTURE: colours.short_caption_future || '#A8A8A8',
      COLOUR_CAPTION_READ: colours.short_caption_read || '#FFFFFF',
      COLOUR_CAPTION_PILL: colours.short_caption_pill || '#2B2B2B',
    };
    const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => (key in values ? values[key] : whole));
    fs.writeFileSync(path.join(compDir, 'index.html'), html);

    console.log(`  ok composition-${compN} <- ${filename} (${duration.toFixed(2)}s, ${words.length} words, ${beats.length} beat${beats.length === 1 ? '' : 's'})`);
  });

  if (process.exitCode) console.error('\nNot ready to render: fix the problems marked above, then run this again.');
  else console.log(`\nDone. Next: bash render-all.sh "${SHORTS_DIR}"`);
}


// ============================================================================
// Helpers
// ============================================================================

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
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
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

function resolveFonts(families, custom, bundledDir) {
  const found = [];
  for (const family of new Set(families)) {
    const source = custom[family]
      ? expandHome(custom[family])
      : path.join(bundledDir, family.replace(/\s+/g, '') + '-Variable.ttf');
    if (fs.existsSync(source)) {
      found.push({ family, source, fileName: path.basename(source) });
    } else {
      console.warn(`  ! no font file for "${family}". Add it to brand.font_files, or HyperFrames lint may block the render.`);
    }
  }
  return found;
}

function clipNumber(filename) {
  const m = /clip[\s_-]*(\d+)/i.exec(filename);
  return m ? parseInt(m[1], 10) : null;
}

function applyGlossary(words, glossary) {
  // Fixes single-word errors in the karaoke captions, keeping punctuation and capitals of the fix.
  const map = new Map();
  for (const [wrong, right] of Object.entries(glossary)) {
    if (wrong.startsWith('_')) continue;
    if (/\s/.test(wrong)) console.warn(`  ! glossary entry "${wrong}" spans several words. Fix it by hand in the transcript JSON.`);
    else map.set(wrong.toLowerCase(), right);
  }
  return words.map(w => {
    const m = /^(\W*)(.*?)(\W*)$/.exec(w.text);
    const fix = m && map.get(m[2].toLowerCase());
    return fix ? { ...w, text: m[1] + fix + m[3] } : w;
  });
}

function parseBeatsForClip(md, compN, durationSeconds, transcriptWords) {
  const sectionRe = new RegExp('##\\s*Clip\\s*' + compN + '\\b[\\s\\S]*?(?=\\n## |$)', 'i');
  const match = md.match(sectionRe);
  if (!match) {
    console.warn(`    ! No "## Clip ${compN}" section in clips.md, so no beats`);
    return [];
  }
  const oslMatch = match[0].match(/\*\*On-screen text:\*\*([\s\S]*?)(?=\n\*\*|\n##|\n---|$)/i);
  if (!oslMatch) {
    console.warn(`    ! Clip ${compN} has no "**On-screen text:**" section, so no beats`);
    return [];
  }

  // Lines look like: - 00:00 - 00:08: `The accent. main.` @anchor
  // Text inside backticks is taken verbatim. The trailing @word anchors the beat to the
  // moment that word is spoken, matched against the clip's transcript.
  const lineRe = /-\s*(\d{1,2}):(\d{2})\s*[\u2013\u2014-]\s*(\d{1,2}):(\d{2})\s*:\s*(?:`([^`\n]+)`|"?([^"\n]+?)"?)\s*(?:@([\w'\u2019-]+))?\s*$/gm;
  const beats = [];
  let m;
  while ((m = lineRe.exec(oslMatch[1]))) {
    beats.push({
      startSpec: parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
      endSpec: parseInt(m[3], 10) * 60 + parseInt(m[4], 10),
      text: (m[5] || m[6]).trim(),
      anchor: m[7] || null,
    });
  }
  if (beats.length === 0) {
    console.warn(`    ! Clip ${compN} has "On-screen text" but no parseable lines`);
    return [];
  }

  // Fallback timing for beats with no anchor: scale the spec range to the real duration.
  const specMaxEnd = Math.max(...beats.map(b => b.endSpec));
  const scale = durationSeconds / ((specMaxEnd > 0 ? specMaxEnd : 30) + 2); // +2s so the last beat exits before the fade
  const norm = s => s.toLowerCase().replace(/[^a-z0-9']/g, '');

  let searchFrom = -2;   // transcript position floor for the next anchor search
  let prevEnd = -1;      // previous beat's exit: beats never stack on screen
  return beats.map(b => {
    let start = +(b.startSpec * scale).toFixed(2);
    if (b.anchor && Array.isArray(transcriptWords)) {
      const target = norm(b.anchor);
      const hit = transcriptWords.find(w => norm(w.text) === target && w.start >= searchFrom + 1);
      if (hit) {
        start = +Math.max(0, hit.start - 0.4).toFixed(2);
        searchFrom = hit.start;
      } else {
        console.warn(`    ! Clip ${compN}: anchor "@${b.anchor}" not found in transcript, using scaled spec timing. Fix it before rendering.`);
        process.exitCode = 1;
      }
    } else if (!b.anchor) {
      console.warn(`    ! Clip ${compN}: beat "${b.text}" has no @anchor, using scaled spec timing.`);
    }
    // never overlap the previous beat; leave the end clear for the fade
    start = +Math.max(start, prevEnd + 0.4).toFixed(2);
    start = +Math.min(start, Math.max(0, durationSeconds - DISPLAY_SECONDS - 0.7)).toFixed(2);
    if (prevEnd > 0 && start < prevEnd) {
      console.warn(`    ! Clip ${compN}: beat "${b.text}" overlaps the one before, because the clip ends too soon. Remove a beat or lengthen the clip.`);
      process.exitCode = 1;
    }
    const end = +Math.min(start + DISPLAY_SECONDS, durationSeconds - 1.2).toFixed(2);
    prevEnd = end;
    const { accent, main } = splitAccentMain(b.text);
    if (accent.length > MAX_ACCENT_CHARS) console.warn(`    ! Clip ${compN}: accent "${accent}" is over ${MAX_ACCENT_CHARS} characters and may run off the frame.`);
    return { start, end, accent, main };
  });
}

function splitAccentMain(text) {
  // 1. Two sentences: the first is the accent, the rest is the main.
  // 2. One sentence: the last 1-2 words are the main, the rest is the accent.
  // 3. Full stops never render. ? and ! survive.
  // 4. The main is 1-2 words at most and lowercase apart from all-caps acronyms.
  const clean = text.replace(/^["'`\s]+|["'`\s]+$/g, '').trim();
  const stripDot = s => s.replace(/\.+\s*$/, '').trim();

  let accent = '', main = '';
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length >= 2) {
    accent = stripDot(sentences[0].trim());
    main = stripDot(sentences.slice(1).join(' ').trim());
  } else {
    const words = clean.split(/\s+/);
    if (words.length <= 2) return { accent: '', main: lowercaseMain(stripDot(clean)) };
    const mainWordCount = Math.min(2, Math.max(1, Math.floor(words.length / 3)));
    main = words.slice(-mainWordCount).join(' ');
    accent = words.slice(0, -mainWordCount).join(' ');
  }

  // Count only tokens with letters or digits ("VAT = ROI" is two words). Shift any excess into the accent.
  const isWord = t => /[a-zA-Z0-9]/.test(t);
  const tokens = main.split(/\s+/);
  while (tokens.filter(isWord).length > 2) {
    const shifted = tokens.shift();
    accent = (accent + ' ' + shifted).trim();
    console.warn(`    ! main "${main}" exceeds 2 words, shifted "${shifted}" into the accent. Fix the copy in clips.md.`);
  }
  return { accent: stripDot(accent), main: lowercaseMain(stripDot(tokens.join(' '))) };
}

function lowercaseMain(main) {
  return main.split(/(\s+)/).map(tok => {
    const letters = tok.replace(/[^a-zA-Z]/g, '');
    return letters.length >= 2 && letters === letters.toUpperCase() ? tok : tok.toLowerCase();
  }).join('');
}

module.exports = { splitAccentMain, lowercaseMain, parseBeatsForClip, applyGlossary, clipNumber };
