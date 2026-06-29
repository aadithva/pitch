#!/usr/bin/env node
// build_motifs.mjs — generate copyright-safe, parametric SVG motif sprites for each
// style pack (assets/styles/<id>/motifs.svg). Motifs are <symbol> defs that use
// `currentColor`, so the renderer tints them per palette. 100% original geometry.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLES = join(__dirname, '..', 'assets', 'styles');

const r2 = (n) => Math.round(n * 100) / 100;
const pt = (cx, cy, a, r) => `${r2(cx + Math.cos(a) * r)},${r2(cy + Math.sin(a) * r)}`;

// --- geometry helpers ---
function starburst(cx, cy, R, r, spikes) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(pt(cx, cy, a, i % 2 ? r : R));
  }
  return `<polygon points="${pts.join(' ')}"/>`;
}
function blobPath(cx, cy, R, n, jitter, seed) {
  // deterministic pseudo-random radius per vertex
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const verts = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const rad = R * (1 - jitter / 2 + rnd() * jitter);
    verts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  let d = `M ${r2(verts[0][0])} ${r2(verts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = verts[i], p1 = verts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    d += ` Q ${r2(p0[0])} ${r2(p0[1])} ${r2(mx)} ${r2(my)}`;
  }
  return d + ' Z';
}
function seigaiha() {
  // concentric-arc wave scales as a tileable <pattern>
  let arcs = '';
  const rings = [22, 16, 10, 4];
  for (const cx of [0, 30, 60]) {
    for (const rr of rings) {
      arcs += `<circle cx="${cx}" cy="30" r="${rr}" fill="none" stroke="currentColor" stroke-width="2"/>`;
    }
  }
  return `<pattern id="jp-seigaiha" width="60" height="30" patternUnits="userSpaceOnUse">${arcs}</pattern>`;
}
function halftone() {
  return `<pattern id="pa-halftone" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="4.2" fill="currentColor"/></pattern>`;
}

// stamp frame: rectangle with perforation notches via dashed circles border
function stampFrame() {
  const holes = [];
  const step = 10;
  for (let x = 5; x <= 95; x += step) { holes.push(`<circle cx="${x}" cy="3" r="2.4"/>`, `<circle cx="${x}" cy="97" r="2.4"/>`); }
  for (let y = 5; y <= 95; y += step) { holes.push(`<circle cx="3" cy="${y}" r="2.4"/>`, `<circle cx="97" cy="${y}" r="2.4"/>`); }
  return `<g fill="currentColor"><rect x="3" y="3" width="94" height="94" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="9" width="82" height="82" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5"/>${holes.join('')}</g>`;
}

// --- per-style symbol sets ---
function symbols(id) {
  const wrap = (sid, vb, inner) => `  <symbol id="${sid}" viewBox="${vb}">${inner}</symbol>`;
  switch (id) {
    case 'pop-art':
      return [
        halftone(),
        wrap('pa-burst', '0 0 100 100', `<g fill="currentColor">${starburst(50, 50, 49, 33, 14)}</g>`),
        wrap('pa-speech', '0 0 100 80', `<g fill="none" stroke="currentColor" stroke-width="4"><path d="M8 8 H92 V54 H40 L22 72 V54 H8 Z" stroke-linejoin="round"/></g>`),
        wrap('pa-frame', '0 0 100 100', `<rect x="4" y="4" width="92" height="92" rx="6" fill="none" stroke="currentColor" stroke-width="6"/>`)
      ];
    case 'japanese-postal':
      return [
        seigaiha(),
        wrap('jp-stamp', '0 0 100 100', stampFrame()),
        wrap('jp-postmark', '0 0 100 100', `<g fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="30" stroke-dasharray="3 4"/><line x1="6" y1="50" x2="94" y2="50"/><line x1="6" y1="44" x2="94" y2="44" stroke-width="1"/><line x1="6" y1="56" x2="94" y2="56" stroke-width="1"/></g>`),
        wrap('jp-seal', '0 0 100 100', `<g fill="none" stroke="currentColor" stroke-width="4"><rect x="10" y="10" width="80" height="80" rx="6"/></g>`)
      ];
    case 'minimalist':
      return [
        wrap('mn-rule', '0 0 100 8', `<rect x="0" y="3" width="48" height="2" fill="currentColor"/>`),
        wrap('mn-dot', '0 0 20 20', `<circle cx="10" cy="10" r="5" fill="currentColor"/>`),
        wrap('mn-bracket', '0 0 40 100', `<path d="M30 4 H10 V96 H30" fill="none" stroke="currentColor" stroke-width="2"/>`),
        wrap('mn-grid', '0 0 60 60', `<g stroke="currentColor" stroke-width="1" opacity="0.5"><line x1="0" y1="20" x2="60" y2="20"/><line x1="0" y1="40" x2="60" y2="40"/><line x1="20" y1="0" x2="20" y2="60"/><line x1="40" y1="0" x2="40" y2="60"/></g>`)
      ];
    case 'vintage':
      return [
        wrap('vn-sunburst', '0 0 100 100', `<g fill="currentColor">${Array.from({ length: 24 }, (_, i) => { const a = (Math.PI * 2 * i) / 24; return `<polygon points="${pt(50, 50, a - 0.04, 12)} ${pt(50, 50, a, 50)} ${pt(50, 50, a + 0.04, 12)}"/>`; }).join('')}</g>`),
        wrap('vn-corner', '0 0 100 100', `<g fill="none" stroke="currentColor" stroke-width="2"><path d="M6 40 V6 H40"/><path d="M12 34 V12 H34"/><circle cx="18" cy="18" r="3" fill="currentColor"/></g>`),
        wrap('vn-ticket', '0 0 100 100', `<g fill="none" stroke="currentColor" stroke-width="2"><path d="M6 20 Q6 6 20 6 H80 Q94 6 94 20 V80 Q94 94 80 94 H20 Q6 94 6 80 Z"/><path d="M6 50 H94" stroke-dasharray="2 4"/></g>`),
        wrap('vn-rule', '0 0 120 12', `<g fill="currentColor" stroke="currentColor"><line x1="0" y1="6" x2="44" y2="6" stroke-width="1.5"/><circle cx="60" cy="6" r="3.5" fill="none" stroke-width="1.5"/><circle cx="60" cy="6" r="1.4"/><line x1="76" y1="6" x2="120" y2="6" stroke-width="1.5"/></g>`)
      ];
    case 'modern-collectible':
      return [
        wrap('mc-card', '0 0 100 140', `<g fill="none" stroke="currentColor" stroke-width="3"><rect x="4" y="4" width="92" height="132" rx="10"/><rect x="11" y="11" width="78" height="118" rx="6" stroke-width="1.5" opacity="0.6"/><path d="M50 4 l10 8 -10 8 -10 -8 Z" fill="currentColor" stroke="none"/></g>`),
        wrap('mc-medallion', '0 0 100 100', `<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="34" stroke-width="1.5"/><g>${Array.from({ length: 32 }, (_, i) => { const a = (Math.PI * 2 * i) / 32; return `<line x1="${pt(50, 50, a, 44).split(',')[0]}" y1="${pt(50, 50, a, 44).split(',')[1]}" x2="${pt(50, 50, a, 40).split(',')[0]}" y2="${pt(50, 50, a, 40).split(',')[1]}" stroke-width="2"/>`; }).join('')}</g></g>`),
        wrap('mc-gem', '0 0 100 100', `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M50 8 L86 38 L50 92 L14 38 Z"/><path d="M14 38 H86 M50 8 L36 38 L50 92 M50 8 L64 38 L50 92"/></g>`)
      ];
    case 'abstract':
      return [
        wrap('ab-blob', '0 0 100 100', `<path d="${blobPath(50, 50, 42, 8, 0.4, 7)}" fill="currentColor"/>`),
        wrap('ab-blob2', '0 0 100 100', `<path d="${blobPath(50, 50, 40, 7, 0.5, 23)}" fill="currentColor"/>`),
        wrap('ab-wave', '0 0 120 40', `<path d="M0 20 Q15 2 30 20 T60 20 T90 20 T120 20" fill="none" stroke="currentColor" stroke-width="3"/>`),
        wrap('ab-scatter', '0 0 100 100', `<g fill="currentColor"><circle cx="20" cy="24" r="8"/><rect x="60" y="14" width="16" height="16" rx="3"/><path d="M44 70 l12 0 -6 -10 Z"/><circle cx="78" cy="74" r="6" fill="none" stroke="currentColor" stroke-width="3"/></g>`)
      ];
    default:
      return [];
  }
}

const ALL = ['pop-art', 'japanese-postal', 'minimalist', 'vintage', 'modern-collectible', 'abstract'];
for (const id of ALL) {
  const dir = join(STYLES, id);
  await mkdir(dir, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">\n<defs>\n${symbols(id).join('\n')}\n</defs>\n</svg>\n`;
  await writeFile(join(dir, 'motifs.svg'), svg, 'utf8');
  process.stdout.write(`\u2713 motifs.svg \u2192 ${id} (${symbols(id).length} symbols)\n`);
}
