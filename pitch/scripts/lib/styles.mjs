// styles.mjs — load a curated visual "style pack" (assets/styles/<id>/) and apply
// it to a deck theme. Fully offline: a style pack ships a palette + font pairing +
// authored SVG motifs + (optional) PD/CC0 raster elements + CSS treatments. No API.
//
// A pack folder contains:
//   style.json   — palette, fonts, backgrounds, motifs, treatments (see schemas/style.schema.json)
//   style.css    — optional CSS background patterns / treatments (uses theme vars)
//   motifs.svg   — optional <symbol> defs the renderer places as accents
//   backgrounds/ — optional raster textures   elements/ — optional PD/CC0 raster motifs
//   LICENSES.md  — provenance for every shipped raster asset

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeTheme } from './theme.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const STYLES_DIR = join(__dirname, '..', '..', 'assets', 'styles');

/** List installed style packs (lightweight metadata for the chooser). */
export async function listStyles() {
  let entries = [];
  try {
    entries = await readdir(STYLES_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
    const jsonPath = join(STYLES_DIR, e.name, 'style.json');
    if (!existsSync(jsonPath)) continue;
    try {
      const p = JSON.parse(await readFile(jsonPath, 'utf8'));
      out.push({ id: p.id || e.name, name: p.name || e.name, tagline: p.tagline || '', recommendWhen: p.recommendWhen || '', mode: p.mode || 'dark' });
    } catch { /* skip malformed */ }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Load a full style pack: parsed style.json + inlined style.css + motifs.svg. */
export async function loadStyle(styleId) {
  if (!styleId) return null;
  const dir = join(STYLES_DIR, styleId);
  const jsonPath = join(dir, 'style.json');
  if (!existsSync(jsonPath)) throw new Error(`style not found: ${styleId} (looked in ${dir})`);
  const pack = JSON.parse(await readFile(jsonPath, 'utf8'));
  const css = existsSync(join(dir, 'style.css')) ? await readFile(join(dir, 'style.css'), 'utf8') : '';
  const motifsSvg = existsSync(join(dir, 'motifs.svg')) ? await readFile(join(dir, 'motifs.svg'), 'utf8') : '';
  return { id: pack.id || styleId, dir, pack, css, motifsSvg };
}

/** Merge a style pack's palette + fonts onto a base theme (palette/fonts win). */
export function applyStyleToTheme(baseTheme, pack) {
  if (!pack) return baseTheme;
  return mergeTheme(baseTheme, {
    source: `style:${pack.id || pack.name || 'custom'}`,
    colors: pack.palette || {},
    fonts: pack.fonts || {},
    fontWeights: pack.fontWeights || {},
    googleFonts: pack.googleFonts || baseTheme.googleFonts
  });
}

// --- recommendation -------------------------------------------------------
// Lightweight, transparent heuristic: map project/brand signals to a suggested
// style with a human reason. The final pick is always the user's.
const RECO_RULES = [
  { style: 'minimalist', reason: 'clean, enterprise/product feel', test: (s) => /fintech|enterprise|b2b|saas|dashboard|infra|developer|api|security|platform/i.test(s) },
  { style: 'pop-art', reason: 'bold, playful, consumer energy', test: (s) => /consumer|social|game|gaming|fun|kids|meme|creator|viral|playful/i.test(s) },
  { style: 'vintage', reason: 'heritage, craft, editorial warmth', test: (s) => /heritage|craft|artisan|coffee|brew|travel|magazine|editorial|classic|wine/i.test(s) },
  { style: 'japanese-postal', reason: 'calm, refined, editorial minimalism', test: (s) => /zen|calm|wellness|mindful|journal|stationery|tea|japan|editorial|slow/i.test(s) },
  { style: 'modern-collectible', reason: 'drops, rarity, fandom appeal', test: (s) => /collectible|web3|nft|drop|rare|trading|badge|reward|loyalty|fan/i.test(s) },
  { style: 'abstract', reason: 'experimental, creative, AI/art vibe', test: (s) => /ai|ml|art|creative|experimental|generative|studio|design|music/i.test(s) }
];

/**
 * Recommend one style from a free-text signal blob (project name + brief + brand).
 * Returns { recommended, reason, ranked: [{style, reason, score}] }.
 */
export function recommendStyle(signalText = '', available = null) {
  const s = String(signalText);
  const allow = available ? new Set(available) : null;
  const ranked = RECO_RULES
    .filter((r) => !allow || allow.has(r.style))
    .map((r) => ({ style: r.style, reason: r.reason, score: r.test(s) ? 1 : 0 }))
    .sort((a, b) => b.score - a.score);
  const top = ranked.find((r) => r.score > 0) || { style: 'minimalist', reason: 'a safe, versatile default' };
  return { recommended: top.style, reason: top.reason, ranked };
}
