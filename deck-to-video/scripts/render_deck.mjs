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
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { renderSlides } from './lib/deck.mjs';
import { loadTheme, compileThemeCss, googleFontsLinks, mergeTheme, loadDefaultTheme } from './lib/theme.mjs';

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

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string', short: 'o' } }
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

  // Render slides + collect the word manifest.
  const { html: slidesHtml, words, useMermaid } = renderSlides(slides);

  // Gather inlined assets.
  const [resetCss, revealCss, baseCss, highlightCss, revealJs] = await Promise.all([
    readFile(join(REVEAL, 'reset.css'), 'utf8'),
    readFile(join(REVEAL, 'reveal.css'), 'utf8'),
    readFile(join(ASSETS, 'base.css'), 'utf8'),
    readFile(join(ASSETS, 'highlight.css'), 'utf8'),
    readFile(join(REVEAL, 'reveal.js'), 'utf8')
  ]);
  const theme = await resolveTheme(themePath);
  const template = await readFile(join(ASSETS, 'deck_template.html'), 'utf8');

  const extraJs = useMermaid
    ? `<script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
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

  const out = template
    .replaceAll('{{TITLE}}', title)
    .replace('{{GOOGLE_FONTS}}', theme.fonts)
    .replace('{{REVEAL_CSS}}', `${resetCss}\n${revealCss}`)
    .replace('{{THEME_CSS}}', theme.css)
    .replace('{{BASE_CSS}}', baseCss)
    .replace('{{HIGHLIGHT_CSS}}', highlightCss)
    .replace('{{SLIDES}}', slidesHtml)
    .replace('{{REVEAL_JS}}', revealJs)
    .replace('{{NARRATION_JSON}}', 'null')
    .replace('{{EXTRA_JS}}', extraJs);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, out, 'utf8');

  const wordsPath = outPath.replace(/\.html?$/i, '') + '.words.json';
  await writeFile(wordsPath, JSON.stringify({ slides: slides.length, words }, null, 2), 'utf8');

  process.stdout.write(
    `\u2713 deck written: ${outPath}\n` +
    `  slides: ${slides.length}, words: ${words.length}\n` +
    `  manifest: ${wordsPath}\n`
  );
}

main().catch((e) => fail(e.stack || e.message));
