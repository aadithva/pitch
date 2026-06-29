# Theming & Style Extraction

How `extract_style.mjs` derives a deck theme from a project, and how to tune it.

## Run it
```bash
node scripts/extract_style.mjs <projectDir> --out build/<name> [--mode dark|light]
```
Writes `theme.json` (canonical) and `theme.css` (compiled reveal.js variables).

## What it reads (priority order)
1. **Coded design tokens** (most reliable, exact):
   - W3C DTCG `tokens.json` (`{ "$type":"color", "$value":"#.." }`)
   - CSS/SCSS `:root { --color-primary: #..; }` custom properties
   - Tailwind `tailwind.config.*` color hexes, and Tailwind v4 `@theme` CSS vars
   - Color values are parsed with **culori**, so modern formats work:
     `hex`, `rgb()`, `hsl()` (incl. bare shadcn `187 94% 43%`), **`oklch()`**,
     `oklab()`, `lab()`, `lch()`, `color()`, and named CSS colors. (Modern
     vibecoded projects on Tailwind v4 / new shadcn use `oklch()` — these are now
     captured instead of silently dropped.)
2. **Logo palette:** finds `logo.*`, `favicon.*`, brand assets; extracts a palette
   with **node-vibrant** (raster only — SVG logos are skipped gracefully).
3. **Fonts:** `@font-face`, Google Fonts `<link>`s, `@fontsource/*` deps.

## How signals map to the theme
- `primary` ← token named `primary|brand|accent|main` → else logo Vibrant/DarkVibrant.
- `secondary` ← `secondary|info|link` → else logo LightVibrant/Muted.
- `accent` ← `accent|tertiary|highlight|success|warning` → else logo LightVibrant.
  If the chosen accent is perceptually dull (low **OKLCH chroma**), the most
  vivid brand candidate is swapped in so the accent always "pops".
- `background` ← kept **dark** by default; a brand `background|bg|surface` token is
  adopted only if it's clearly dark (so contrast stays safe). `--mode light` flips
  to a light scheme.
- **Legibility guard:** body/muted text is checked for **WCAG contrast** against the
  final background and corrected if an adopted brand foreground would be unreadable.
- `heading`/`body` fonts ← first/second Google or `@font-face`/`@fontsource` family.
- `highlight` (karaoke color) ← stays a high-contrast warm default for readability.

Anything not found falls back to `assets/default_theme.json`.

## theme.json shape
```json
{
  "source": "extracted",
  "colors": { "background", "surface", "text", "muted", "primary", "secondary", "accent", "highlight" },
  "fonts": { "heading", "body" },
  "googleFonts": ["Poppins:wght@500;700", "IBM+Plex+Sans:wght@400;600"],
  "logo": "public/logo.svg"
}
```

## Manual overrides
`theme.json` is plain JSON — edit any color/font and re-run `render_deck.mjs`. Or
hand-write a `theme.json` and skip extraction entirely. `render_deck.mjs` also
accepts a raw `theme.css` if you prefer to control CSS directly (it will look for
a sibling `theme.json` to pick up Google Font links).

## reveal.js variable mapping (in `theme.css`)
`--bg, --surface, --text, --muted, --primary, --secondary, --accent, --highlight,
--font-heading, --font-body`. `assets/base.css` consumes these, so the whole deck
re-skins from one file.

## Notes / limits
- Light-mode contrast tuning is basic (Phase 1). Review frames after `--mode light`.
- Fonts load via Google Fonts `<link>` (needs network at view time). System
  fallbacks keep the deck legible offline.
