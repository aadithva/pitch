#!/usr/bin/env node
// extract_style.mjs — derive a deck theme from a project's visual identity.
//
// Usage:
//   node extract_style.mjs <projectDir> --out <dir> [--mode dark|light]
//
// Output: writes <dir>/theme.json (canonical) and <dir>/theme.css (compiled
// reveal.js custom properties). The deck keeps a dark, professional base and
// adopts the project's brand primary/secondary/accent colors + fonts.
//
// Signal priority (most reliable first):
//   1. Coded design tokens   — W3C DTCG tokens.json, CSS/SCSS :root vars
//   2. Tailwind config        — brand color hexes
//   3. Logo palette           — node-vibrant on the project's logo/favicon
//   4. Fonts                  — @font-face, Google Fonts, @fontsource deps
// Anything not found falls back to the bundled default theme.

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, extname, basename, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { loadDefaultTheme, mergeTheme, compileThemeCss } from './lib/theme.mjs';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', 'vendor', '.cache', 'tmp', '.venv', '__pycache__'
]);
const TEXT_EXT = new Set(['.css', '.scss', '.sass', '.less', '.json', '.js', '.ts', '.cjs', '.mjs', '.html', '.vue', '.svelte']);

function log(msg) {
  process.stderr.write(`extract_style: ${msg}\n`);
}

/** Recursively collect files (bounded), skipping heavy/irrelevant dirs. */
async function walk(dir, { maxFiles = 4000 } = {}) {
  const out = [];
  async function rec(d, depth) {
    if (out.length >= maxFiles || depth > 8) return;
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name) || e.name.startsWith('.')) continue;
        await rec(p, depth + 1);
      } else {
        out.push(p);
      }
    }
  }
  await rec(dir, 0);
  return out;
}

// ---- color helpers ----------------------------------------------------------

function normalizeHex(h) {
  if (!h) return null;
  h = h.trim().toLowerCase();
  const m = h.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return '#' + hex;
}

function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

function parseColor(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  const hex = normalizeHex(v);
  if (hex) return hex;
  const rgb = v.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (rgb) return rgbToHex(+rgb[1], +rgb[2], +rgb[3]);
  return null;
}

function luminance(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// ---- signal extractors ------------------------------------------------------

/** Named color tokens from CSS/SCSS :root and bare custom properties. */
function extractCssVars(text) {
  const found = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;}{]+)[;}]/gi;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1].toLowerCase();
    const color = parseColor(m[2]);
    if (color) found[name] = color;
  }
  return found;
}

/** Colors from a W3C DTCG tokens file: { $type:'color', $value:'#..' }. */
function extractDtcgColors(json) {
  const named = {};
  function walkTok(node, path) {
    if (!node || typeof node !== 'object') return;
    if (node.$value && (node.$type === 'color' || typeof node.$value === 'string')) {
      const c = parseColor(String(node.$value));
      if (c) named[path.join('-').toLowerCase()] = c;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      walkTok(v, [...path, k]);
    }
  }
  walkTok(json, []);
  return named;
}

/** Best-effort brand hexes from a tailwind config (regex, no eval). */
function extractTailwindColors(text) {
  const named = {};
  // capture `primary: '#hex'` / `brand: { 500: '#hex' }` style fragments
  const re = /([a-z0-9-]+)\s*:\s*['"]?(#[0-9a-fA-F]{3,6})['"]?/g;
  let m;
  while ((m = re.exec(text))) {
    const c = normalizeHex(m[2]);
    if (c) named[m[1].toLowerCase()] = c;
  }
  return named;
}

/** First named token whose key matches a pattern. */
function pick(named, re) {
  for (const [k, v] of Object.entries(named)) if (re.test(k)) return v;
  return null;
}

async function findLogo(files) {
  const score = (p) => {
    const b = basename(p).toLowerCase();
    let s = 0;
    if (/logo/.test(b)) s += 5;
    if (/brand/.test(b)) s += 4;
    if (/icon/.test(b)) s += 2;
    if (/favicon/.test(b)) s += 1;
    if (/(^|\/)(public|assets|static|src)(\/|$)/.test(p)) s += 1;
    if (extname(p) === '.png') s += 2;
    if (extname(p) === '.svg') s += 1;
    if (/(^|\/)(apple-touch-icon)/.test(b)) s += 1;
    return s;
  };
  const imgs = files
    .filter((p) => ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(extname(p).toLowerCase()))
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return imgs.length ? imgs[0].p : null;
}

async function vibrantPalette(logoPath) {
  // node-vibrant cannot read SVG; only raster formats.
  if (['.svg'].includes(extname(logoPath).toLowerCase())) return null;
  try {
    const { Vibrant } = await import('node-vibrant/node');
    const pal = await Vibrant.from(logoPath).getPalette();
    const hx = (s) => (s ? s.hex : null);
    return {
      vibrant: hx(pal.Vibrant),
      darkVibrant: hx(pal.DarkVibrant),
      lightVibrant: hx(pal.LightVibrant),
      muted: hx(pal.Muted),
      darkMuted: hx(pal.DarkMuted),
      lightMuted: hx(pal.LightMuted)
    };
  } catch (e) {
    log(`logo palette skipped (${e.message})`);
    return null;
  }
}

function extractFonts(allText, pkg) {
  const families = new Set();
  const google = new Set();

  for (const text of allText) {
    for (const m of text.matchAll(/@font-face[^}]*?font-family\s*:\s*["']?([^"';]+)/gi)) {
      families.add(m[1].trim());
    }
    for (const m of text.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'`)]+)/gi)) {
      for (const fam of m[1].matchAll(/family=([^&:]+)(?::[^&]*)?/g)) {
        google.add(decodeURIComponent(fam[1].replace(/\+/g, ' ')));
      }
    }
  }
  if (pkg) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const k of Object.keys(deps)) {
      if (k.startsWith('@fontsource/') || k.startsWith('@fontsource-variable/')) {
        families.add(k.replace(/@fontsource(-variable)?\//, '').replace(/-/g, ' '));
      }
    }
  }
  return { families: [...families], google: [...google] };
}

function titleCaseFamily(f) {
  return f.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- resolution -------------------------------------------------------------

function resolveTheme(base, signals, mode) {
  const { named, vibrant, fonts } = signals;
  const colors = { ...base.colors };

  const brandPrimary =
    pick(named, /(^|[-_])(primary|brand|accent|main|theme|interactive)([-_]|$)/) ||
    (vibrant && (vibrant.vibrant || vibrant.darkVibrant)) ||
    base.colors.primary;
  const brandSecondary =
    pick(named, /(^|[-_])(secondary|info|link)([-_]|$)/) ||
    (vibrant && (vibrant.lightVibrant || vibrant.muted)) ||
    base.colors.secondary;
  const brandAccent =
    pick(named, /(^|[-_])(accent|tertiary|highlight|success|warning)([-_]|$)/) ||
    (vibrant && (vibrant.lightVibrant || vibrant.vibrant)) ||
    base.colors.accent;

  colors.primary = brandPrimary;
  colors.secondary = brandSecondary;
  colors.accent = brandAccent;

  // Optional background adoption: only if a clear brand bg exists and matches mode.
  const brandBg = pick(named, /(^|[-_])(background|bg|surface|base|canvas)([-_]|$)/);
  if (mode === 'light') {
    colors.background = (brandBg && luminance(brandBg) > 0.6 ? brandBg : '#ffffff');
    colors.surface = '#f1f5f9';
    colors.text = pick(named, /(^|[-_])(text|foreground|fg|ink)([-_]|$)/) || '#0f172a';
    colors.muted = '#475569';
  } else if (brandBg && luminance(brandBg) < 0.25) {
    colors.background = brandBg;
  }

  // Fonts
  const headingFamily = fonts.google[0] || fonts.families[0];
  const bodyFamily = fonts.google[1] || fonts.google[0] || fonts.families[1] || fonts.families[0];
  const googleFonts = [];
  if (fonts.google[0]) googleFonts.push(fonts.google[0].replace(/ /g, '+') + ':wght@500;700');
  if (fonts.google[1]) googleFonts.push(fonts.google[1].replace(/ /g, '+') + ':wght@400;600');

  const themeFonts = { ...base.fonts };
  if (headingFamily) themeFonts.heading = `'${titleCaseFamily(headingFamily)}', ${base.fonts.heading}`;
  if (bodyFamily) themeFonts.body = `'${titleCaseFamily(bodyFamily)}', ${base.fonts.body}`;

  return mergeTheme(base, {
    source: 'extracted',
    colors,
    fonts: themeFonts,
    googleFonts: googleFonts.length ? googleFonts : base.googleFonts,
    logo: signals.logo || null
  });
}

// ---- main -------------------------------------------------------------------

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string', short: 'o' }, mode: { type: 'string' } }
  });

  const projectDir = positionals[0];
  if (!projectDir) {
    log('missing <projectDir>. Usage: extract_style.mjs <projectDir> --out <dir> [--mode dark|light]');
    process.exit(1);
  }
  if (!existsSync(projectDir)) {
    log(`project dir not found: ${projectDir}`);
    process.exit(1);
  }
  const mode = values.mode === 'light' ? 'light' : 'dark';
  const outDir = resolve(values.out || join(projectDir, '.deck-theme'));

  const base = await loadDefaultTheme();
  const files = await walk(projectDir);

  // Gather text-based signals.
  const named = {};
  const allText = [];
  let pkg = null;

  for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    let text;
    try {
      text = await readFile(f, 'utf8');
    } catch {
      continue;
    }
    const b = basename(f).toLowerCase();

    if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less' || ext === '.vue' || ext === '.svelte' || ext === '.html') {
      Object.assign(named, extractCssVars(text));
      allText.push(text);
    }
    if (b.startsWith('tailwind.config')) Object.assign(named, extractTailwindColors(text));
    if (ext === '.js' || ext === '.ts' || ext === '.mjs' || ext === '.cjs' || ext === '.html' || ext === '.vue') {
      allText.push(text);
    }
    if (ext === '.json') {
      try {
        const j = JSON.parse(text);
        if (b === 'package.json') pkg = j;
        else Object.assign(named, extractDtcgColors(j));
      } catch {
        /* ignore non-JSON-y json */
      }
    }
  }

  const logo = await findLogo(files);
  const vibrant = logo ? await vibrantPalette(logo) : null;
  const fonts = extractFonts(allText, pkg);

  const signals = { named, vibrant, fonts, logo: logo ? relative(projectDir, logo) : null };
  const theme = resolveTheme(base, signals, mode);

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'theme.json'), JSON.stringify(theme, null, 2), 'utf8');
  await writeFile(join(outDir, 'theme.css'), compileThemeCss(theme), 'utf8');

  const summary = {
    namedTokens: Object.keys(named).length,
    logo: signals.logo,
    vibrant: !!vibrant,
    fonts: fonts.google.length || fonts.families.length,
    source: theme.source
  };
  process.stdout.write(
    `\u2713 theme written: ${join(outDir, 'theme.json')}\n` +
    `  primary:${theme.colors.primary} secondary:${theme.colors.secondary} accent:${theme.colors.accent} bg:${theme.colors.background}\n` +
    `  signals: ${JSON.stringify(summary)}\n`
  );
}

main().catch((e) => {
  log(e.stack || e.message);
  process.exit(1);
});
