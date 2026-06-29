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
import { parse, formatHex, oklch, wcagContrast } from 'culori';
import { loadDefaultTheme, mergeTheme, compileThemeCss } from './lib/theme.mjs';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', 'vendor', '.cache', 'tmp', '.venv', '__pycache__'
]);
const TEXT_EXT = new Set(['.css', '.scss', '.sass', '.less', '.json', '.js', '.jsx', '.ts', '.tsx', '.cjs', '.mjs', '.html', '.vue', '.svelte', '.astro', '.mdx']);

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

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}

/** Linear blend between two hex colors (t=0 -> a, t=1 -> b). */
function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.replace('#', '').slice(i - 1, i + 1), 16));
  const [ar, ag, ab] = p(a), [br, bg, bb] = p(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function parseColor(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  // Skip keywords culori would coerce into a real color (e.g. transparent -> #000).
  if (/^(transparent|currentcolor|inherit|initial|unset|none|auto)$/.test(v)) return null;
  const hex = normalizeHex(v);
  if (hex) return hex;
  // Bare shadcn HSL triplet: "187 94% 43%" or "187, 94%, 43%".
  const bare = v.match(/^(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%$/);
  if (bare) return hslToHex(+bare[1], +bare[2], +bare[3]);
  // Everything else (rgb/hsl/oklch/oklab/lab/lch/color()/named) via culori — this
  // is what lets modern projects (Tailwind v4, new shadcn) keep their brand colors.
  try {
    const c = parse(v);
    if (c) {
      const h = formatHex(c);
      if (h) return normalizeHex(h) || h;
    }
  } catch { /* not a parseable color */ }
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

/** Perceptual chroma (OKLCH C, ~0..0.4) — finds a brand color with real "pop".
 *  More accurate than HSL saturation, matching color-thief v3's OKLCH scoring. */
function chroma(hex) {
  if (!hex) return 0;
  try {
    const c = oklch(hex);
    return c && Number.isFinite(c.c) ? c.c : 0;
  } catch {
    return 0;
  }
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
  const googleNames = new Set();   // family display names
  const googleSpecs = new Set();   // raw "Family:wght@..." specs (exact weights preserved)
  const roles = {};                // heading / body / mono -> family name (from CSS vars)

  for (const text of allText) {
    // @font-face families
    for (const m of text.matchAll(/@font-face[^}]*?font-family\s*:\s*["']?([^"';]+)/gi)) {
      families.add(m[1].trim());
    }
    // Google Fonts <link> hrefs — capture each family spec verbatim (with weights)
    for (const m of text.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'`)\s]+)/gi)) {
      for (const fam of m[1].matchAll(/family=([^&]+)/g)) {
        const spec = fam[1];
        googleSpecs.add(spec);
        googleNames.add(decodeURIComponent(spec.split(':')[0].replace(/\+/g, ' ')).trim());
      }
    }
    // Font-role CSS vars: --font-display / --font-heading / --font-body / --font-mono (and --ds-*)
    for (const m of text.matchAll(/--(?:ds-)?font-(display|heading|title|body|text|sans|mono)\s*:\s*([^;}{]+)/gi)) {
      const role = m[1].toLowerCase();
      const famMatch = m[2].match(/["']?([^"',;()]+)/);
      const name = famMatch && famMatch[1].trim();
      if (!name || /^(var|inherit|initial|unset)/i.test(name)) continue;
      if ((role === 'display' || role === 'heading' || role === 'title') && !roles.heading) roles.heading = name;
      else if ((role === 'body' || role === 'text' || role === 'sans') && !roles.body) roles.body = name;
      else if (role === 'mono' && !roles.mono) roles.mono = name;
    }
    // next/font/google imports (Next.js / shadcn): import { Space_Grotesk } from 'next/font/google'
    for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/g)) {
      for (const f of m[1].split(',')) {
        const name = f.trim().replace(/\s+as\s+\w+/i, '').replace(/_/g, ' ').trim();
        if (name && /^[A-Z]/.test(name)) families.add(name);
      }
    }
    // next/font role mapping: const x = Space_Grotesk({ ..., variable: '--font-heading' })
    for (const m of text.matchAll(/([A-Z][A-Za-z0-9_]+)\s*\(\s*\{[^}]*?variable\s*:\s*['"]--font-([a-z-]+)['"]/g)) {
      const fam = m[1].replace(/_/g, ' ');
      const role = m[2].toLowerCase();
      if (/(head|display|title)/.test(role) && !roles.heading) roles.heading = fam;
      else if (/(body|sans|text)/.test(role) && !roles.body) roles.body = fam;
      else if (/mono/.test(role) && !roles.mono) roles.mono = fam;
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
  return { families: [...families], google: [...googleNames], googleSpecs: [...googleSpecs], roles };
}

function titleCaseFamily(f) {
  return f.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Heaviest numeric weight present in a Google Fonts family spec (default 400). */
function maxWeightFromSpec(spec) {
  if (!spec) return 400;
  const w = spec.match(/wght@([^&]+)/);
  if (!w) return 400;
  const nums = w[1].match(/\d{3}/g);
  return nums && nums.length ? Math.max(...nums.map(Number)) : 400;
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

  // The accent should "pop". If the chosen accent is desaturated (e.g. white/
  // gray on a monochrome brand), swap in the most saturated brand candidate.
  if (chroma(colors.accent) < 0.06) {
    const candidates = [
      pick(named, /(^|[-_])(accent|tertiary|highlight|brand|primary|secondary)([-_]|$)/),
      brandSecondary, brandPrimary,
      vibrant && vibrant.vibrant, vibrant && vibrant.lightVibrant, vibrant && vibrant.darkVibrant
    ].filter(Boolean);
    let best = colors.accent, bestSat = chroma(colors.accent);
    for (const c of candidates) {
      const s = chroma(c);
      if (s > bestSat) { bestSat = s; best = c; }
    }
    colors.accent = best;
  }

  // Optional background + surface/text adoption for dark brands.
  const brandBg = pick(named, /(^|[-_])(background|bg|base|canvas)([-_]|$)/);
  const brandSurface = pick(named, /(^|[-_])(card|surface|popover|panel|elevated)([-_]|$)/);
  const brandText = pick(named, /(^|[-_])(foreground|text|ink|fg)([-_]|$)/);
  const brandMuted = pick(named, /(^|[-_])(muted[-_]?foreground|muted[-_]?fg|secondary[-_]?foreground|subtle)([-_]|$)/);
  if (mode === 'light') {
    colors.background = (brandBg && luminance(brandBg) > 0.6 ? brandBg : '#ffffff');
    colors.surface = (brandSurface && luminance(brandSurface) > 0.85) ? brandSurface : '#f1f5f9';
    colors.text = (brandText && luminance(brandText) < 0.3) ? brandText : '#0f172a';
    colors.muted = '#475569';
  } else if (brandBg && luminance(brandBg) < 0.25) {
    colors.background = brandBg;
    colors.surface = (brandSurface && luminance(brandSurface) < 0.35)
      ? brandSurface : mixHex(brandBg, '#ffffff', 0.08);
    if (brandText && luminance(brandText) > 0.6) colors.text = brandText;
    if (brandMuted && luminance(brandMuted) > 0.25 && luminance(brandMuted) < 0.8) colors.muted = brandMuted;
  }

  // Legibility guard: guarantee body/muted text stay readable against the chosen
  // background (WCAG AA ~4.5:1 for body, ~3:1 for muted). Prevents an adopted brand
  // foreground from going unreadable on our base surface.
  if (wcagContrast(colors.text, colors.background) < 4.5) {
    colors.text = wcagContrast('#f8fafc', colors.background) >= wcagContrast('#0f172a', colors.background)
      ? '#f8fafc' : '#0f172a';
  }
  if (colors.muted && wcagContrast(colors.muted, colors.background) < 3) {
    colors.muted = mixHex(colors.text, colors.background, 0.4);
  }

  // Fonts
  const r = fonts.roles || {};
  const isMono = (n) => /mono/i.test(n || '');
  const nonMono = (arr) => arr.filter((n) => !isMono(n));
  const headingFamily = r.heading || nonMono(fonts.google)[0] || nonMono(fonts.families)[0] || null;
  const bodyFamily = r.body || nonMono(fonts.google)[1] || nonMono(fonts.google)[0] || nonMono(fonts.families)[1] || nonMono(fonts.families)[0] || null;
  const monoFamily = r.mono || fonts.google.find(isMono) || fonts.families.find(isMono) || null;

  // Map family name -> the project's exact Google Fonts spec (with weights).
  const specByName = new Map();
  for (const spec of fonts.googleSpecs || []) {
    const key = decodeURIComponent(spec.split(':')[0].replace(/\+/g, ' ')).trim().toLowerCase();
    specByName.set(key, spec);
  }
  const googleFonts = [];
  const seen = new Set();
  const weights = {};
  for (const [slot, fam] of [['heading', headingFamily], ['body', bodyFamily], ['mono', monoFamily]]) {
    if (!fam) continue;
    const key = fam.toLowerCase();
    const spec = specByName.get(key) || (fam.replace(/ /g, '+') + ':wght@400;700');
    const maxW = maxWeightFromSpec(spec);
    const has400 = !/wght@/.test(spec) || /(?:^|\D)400(?:\D|$)/.test(spec);
    // Headings use the heaviest weight; body should read at 400 (not bold).
    weights[slot] = slot === 'heading' ? maxW : (has400 ? 400 : Math.min(maxW, 500));
    if (!seen.has(key)) { seen.add(key); googleFonts.push(spec); }
  }

  const themeFonts = { ...base.fonts };
  if (headingFamily) themeFonts.heading = `'${titleCaseFamily(headingFamily)}', ${base.fonts.heading}`;
  if (bodyFamily) themeFonts.body = `'${titleCaseFamily(bodyFamily)}', ${base.fonts.body}`;
  themeFonts.mono = monoFamily
    ? `'${titleCaseFamily(monoFamily)}', ${base.fonts.mono || "'Space Mono', ui-monospace, monospace"}`
    : (base.fonts.mono || "'Space Mono', ui-monospace, SFMono-Regular, monospace");

  return mergeTheme(base, {
    source: 'extracted',
    colors,
    fonts: themeFonts,
    fontWeights: {
      heading: weights.heading || base.fontWeights?.heading || 700,
      body: weights.body || base.fontWeights?.body || 400
    },
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

    if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less' || ext === '.vue' || ext === '.svelte' || ext === '.astro' || ext === '.html' || ext === '.mdx') {
      Object.assign(named, extractCssVars(text));
      allText.push(text);
    }
    if (b.startsWith('tailwind.config')) Object.assign(named, extractTailwindColors(text));
    if (ext === '.js' || ext === '.jsx' || ext === '.ts' || ext === '.tsx' || ext === '.mjs' || ext === '.cjs' || ext === '.html' || ext === '.vue' || ext === '.astro' || ext === '.mdx') {
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
