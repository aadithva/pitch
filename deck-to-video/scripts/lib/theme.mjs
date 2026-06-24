// theme.mjs — load a theme.json and compile it to CSS + Google Fonts links.
// Shared by extract_style.mjs (writes theme) and render_deck.mjs (consumes theme).

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_THEME_PATH = join(__dirname, '..', '..', 'assets', 'default_theme.json');

/** Load the bundled default theme (used as a base so partial themes always work). */
export async function loadDefaultTheme() {
  return JSON.parse(await readFile(DEFAULT_THEME_PATH, 'utf8'));
}

/** Deep-ish merge: override colors/fonts on top of the default theme. */
export function mergeTheme(base, override = {}) {
  return {
    ...base,
    ...override,
    colors: { ...base.colors, ...(override.colors || {}) },
    fonts: { ...base.fonts, ...(override.fonts || {}) },
    googleFonts: override.googleFonts ?? base.googleFonts,
    logo: override.logo ?? base.logo,
    source: override.source ?? base.source
  };
}

/** Load a theme.json from disk, merged over the default theme. */
export async function loadTheme(path) {
  const base = await loadDefaultTheme();
  if (!path) return base;
  const raw = JSON.parse(await readFile(path, 'utf8'));
  return mergeTheme(base, raw);
}

/** Compile a theme object into CSS custom properties + base background. */
export function compileThemeCss(theme) {
  const c = theme.colors || {};
  const f = theme.fonts || {};
  return `:root{
  --bg: ${c.background};
  --surface: ${c.surface};
  --text: ${c.text};
  --muted: ${c.muted};
  --primary: ${c.primary};
  --secondary: ${c.secondary};
  --accent: ${c.accent};
  --highlight: ${c.highlight};
  --font-heading: ${f.heading};
  --font-body: ${f.body};
}
html, body, .reveal { background: var(--bg); }
`;
}

/** Build a Google Fonts <link> block from theme.googleFonts (array of family specs). */
export function googleFontsLinks(theme) {
  const fams = theme.googleFonts || [];
  if (!fams.length) return '';
  const href =
    'https://fonts.googleapis.com/css2?' +
    fams.map((s) => 'family=' + s).join('&') +
    '&display=swap';
  return (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    `  <link rel="stylesheet" href="${href}">`
  );
}
