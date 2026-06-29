#!/usr/bin/env node
// render_deck.mjs — slides.json (+ theme) -> self-contained reveal.js deck.html
//
// Usage:
//   node render_deck.mjs <slides.json> [theme.json|theme.css] --out <deck.html>
//
// Output: writes deck.html and a sibling deck.words.json (word manifest used by
// the Phase 3/4 narration pipeline). The deck is a single portable HTML file
// with reveal.js, theme, and layout CSS inlined.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { renderSlides } from './lib/deck.mjs';
import { loadTheme, compileThemeCss, googleFontsLinks, mergeTheme, loadDefaultTheme } from './lib/theme.mjs';
import { loadStyle, applyStyleToTheme } from './lib/styles.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(__dirname, '..');
const ASSETS = join(SKILL_ROOT, 'assets');
const REVEAL = join(SKILL_ROOT, 'node_modules', 'reveal.js', 'dist');

function fail(msg) {
  process.stderr.write(`render_deck: ${msg}\n`);
  process.exit(1);
}

async function resolveTheme(themePath) {
  if (!themePath) {
    const theme = await loadTheme(null);
    return { css: compileThemeCss(theme), fonts: googleFontsLinks(theme) };
  }
  if (themePath.endsWith('.json')) {
    const theme = await loadTheme(themePath);
    return { css: compileThemeCss(theme), fonts: googleFontsLinks(theme) };
  }
  // Raw .css theme: inline as-is, try a sibling theme.json for font links.
  const css = await readFile(themePath, 'utf8');
  const siblingJson = join(dirname(themePath), 'theme.json');
  let fonts = '';
  if (existsSync(siblingJson)) {
    const base = await loadDefaultTheme();
    const theme = mergeTheme(base, JSON.parse(await readFile(siblingJson, 'utf8')));
    fonts = googleFontsLinks(theme);
  }
  return { css, fonts };
}

// --- visual style packs --------------------------------------------------
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function inlineImg(p) {
  try {
    const ext = (p.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    return `data:${MIME[ext] || 'image/jpeg'};base64,${readFileSync(p).toString('base64')}`;
  } catch { return null; }
}
function roleOf(slide, i, total) {
  if (slide.layout === 'divider' || slide.type === 'section') return 'divider';
  if (i === 0 || slide.type === 'cover') return 'cover';
  if (i === total - 1 && (slide.type === 'cta' || slide.layout === 'closing')) return 'closing';
  return 'content';
}
function buildStyleCtx(pack, dir, total) {
  const bgById = {};
  for (const b of (pack.backgrounds || [])) bgById[b.id] = b;
  const elemSrc = {};
  for (const e of (pack.elements || [])) elemSrc[e.src.split('/').pop().replace(/\.[^.]+$/, '')] = e.src;
  function resolveBg(ref, role) {
    if (!ref) return '';
    let kind = null, src = null, opacity = null;
    if (bgById[ref]) { ({ kind, src, opacity } = bgById[ref]); }
    else if (elemSrc[ref]) { kind = 'image'; src = elemSrc[ref]; }
    else return '';
    if ((kind === 'image' || kind === 'texture') && src) {
      const uri = inlineImg(join(dir, src));
      return uri ? `<div class="slide-bg scrim"><img src="${uri}" alt=""></div>` : '';
    }
    // Patterns/gradients get a soft scrim on cover/closing so titles stay legible.
    const scrim = (role === 'cover' || role === 'closing') ? ' scrim-soft' : '';
    return `<div class="slide-bg bgp-${ref}${scrim}" style="opacity:${opacity != null ? opacity : 1}"></div>`;
  }
  function resolveMotifs(ids) {
    return (ids || []).map((id) => {
      const m = (pack.motifs || []).find((x) => x.id === id) || { id };
      return `<svg class="motif m-${m.placement || 'top-right'}" aria-hidden="true"><use href="#${id}"/></svg>`;
    }).join('');
  }
  function treat(role) {
    const t = (pack.treatments && pack.treatments[role]) || {};
    let bgRef = t.background;
    if (!bgRef && (role === 'content' || role === 'closing')) {
      const b = (pack.backgrounds || []).find((x) => (x.use || []).includes(role));
      if (b) bgRef = b.id;
    }
    return { bg: resolveBg(bgRef, role), motifs: resolveMotifs(t.motifs) };
  }
  const byRole = {};
  for (const r of ['cover', 'content', 'closing', 'divider']) byRole[r] = treat(r);
  return { byRole, total, roleOf };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string', short: 'o' }, style: { type: 'string' } }
  });

  const slidesPath = positionals[0];
  const themePath = positionals[1];
  if (!slidesPath) fail('missing <slides.json>. Usage: render_deck.mjs <slides.json> [theme.json] --out <deck.html>');
  if (!existsSync(slidesPath)) fail(`slides file not found: ${slidesPath}`);

  let spec;
  try {
    spec = JSON.parse(await readFile(slidesPath, 'utf8'));
  } catch (e) {
    fail(`could not parse slides JSON: ${e.message}`);
  }
  const slides = Array.isArray(spec) ? spec : spec.slides;
  if (!Array.isArray(slides) || slides.length === 0) fail('slides spec has no slides[].');

  const outPath = resolve(values.out || 'deck.html');
  const title = (spec.title) || (slides[0] && slides[0].title) || 'Presentation';

  // Optional visual style pack (palette + fonts + motifs + backgrounds).
  let stylePack = null, styleCtx = null, styleRuntimeCss = '';
  if (values.style) {
    try { stylePack = await loadStyle(values.style); }
    catch (e) { fail(e.message); }
    styleCtx = buildStyleCtx(stylePack.pack, stylePack.dir, slides.length);
    styleRuntimeCss = await readFile(join(ASSETS, 'styles.css'), 'utf8');
  }

  // Render slides + collect the word manifest.
  const { html: slidesHtml, words, useMermaid } = renderSlides(slides, styleCtx);

  // Gather inlined assets.
  const [resetCss, revealCss, baseCss, highlightCss, revealJs] = await Promise.all([
    readFile(join(REVEAL, 'reset.css'), 'utf8'),
    readFile(join(REVEAL, 'reveal.css'), 'utf8'),
    readFile(join(ASSETS, 'base.css'), 'utf8'),
    readFile(join(ASSETS, 'highlight.css'), 'utf8'),
    readFile(join(REVEAL, 'reveal.js'), 'utf8')
  ]);
  // Theme: merge the style pack's palette + fonts when a style is active.
  let theme;
  if (stylePack) {
    const baseTheme = themePath && themePath.endsWith('.json') ? await loadTheme(themePath) : await loadTheme(null);
    const merged = applyStyleToTheme(baseTheme, stylePack.pack);
    theme = { css: compileThemeCss(merged), fonts: googleFontsLinks(merged) };
  } else {
    theme = await resolveTheme(themePath);
  }
  const template = await readFile(join(ASSETS, 'deck_template.html'), 'utf8');

  const extraJs = useMermaid
    ? `<script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose',
      flowchart: { htmlLabels: true, useMaxWidth: true, padding: 16, nodeSpacing: 40 } });
    // Render diagrams only for the slide that is actually visible: a mermaid
    // node measured while its slide is display:none collapses to zero size.
    async function renderCurrent() {
      const nodes = document.querySelectorAll('.reveal section.present .mermaid:not([data-processed])');
      if (nodes.length) {
        try { await mermaid.run({ nodes: [...nodes] }); } catch (e) { console.error('mermaid', e); }
      }
    }
    if (window.Reveal) {
      Reveal.on('ready', renderCurrent);
      Reveal.on('slidechanged', renderCurrent);
    } else {
      window.addEventListener('load', renderCurrent);
    }
  </script>`
    : '';

  let out = template
    .replaceAll('{{TITLE}}', title)
    .replace('{{GOOGLE_FONTS}}', theme.fonts)
    .replace('{{REVEAL_CSS}}', `${resetCss}\n${revealCss}`)
    .replace('{{THEME_CSS}}', theme.css)
    .replace('{{BASE_CSS}}', baseCss)
    .replace('{{HIGHLIGHT_CSS}}', `${highlightCss}${stylePack ? `\n/* === styles.css (visual style runtime) === */\n${styleRuntimeCss}\n${stylePack.css || ''}` : ''}`)
    .replace('{{SLIDES}}', slidesHtml)
    .replace('{{REVEAL_JS}}', revealJs)
    .replace('{{NARRATION_JSON}}', 'null')
    .replace('{{EXTRA_JS}}', extraJs);

  // Inject the motif sprite (outside .slides so reveal doesn't treat it as a slide).
  if (stylePack && stylePack.motifsSvg) {
    out = out.replace('<div class="reveal">', `${stylePack.motifsSvg}\n  <div class="reveal">`);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, out, 'utf8');

  const wordsPath = outPath.replace(/\.html?$/i, '') + '.words.json';
  await writeFile(wordsPath, JSON.stringify({ slides: slides.length, words }, null, 2), 'utf8');

  process.stdout.write(
    `\u2713 deck written: ${outPath}\n` +
    `  slides: ${slides.length}, words: ${words.length}${stylePack ? `, style: ${stylePack.id}` : ''}\n` +
    `  manifest: ${wordsPath}\n`
  );
}

main().catch((e) => fail(e.stack || e.message));
