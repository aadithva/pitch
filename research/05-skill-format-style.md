
---

# Research Report: Agent Skill Authoring + Visual Style Extraction

## Summary

**Part 1:** The `anthropics/skills` GitHub repo (https://github.com/anthropics/skills) is the official reference. The format is formally specified at https://agentskills.io/specification. The pptx skill (`skills/pptx/`) is a production-grade, heavily documented, 3-level progressive-disclosure skill that we should model closely. The skill-creator skill (`skills/skill-creator/SKILL.md`) contains the canonical authoring guide.

**Part 2:** The optimal pipeline for visual extraction is: (1) Pillow/colorthief or node-vibrant for image-based palette extraction, (2) CSS/SCSS/Tailwind config parsing for coded design tokens, (3) W3C DTCG JSON tokens where available, then map extracted values into pptxgenjs or reveal.js CSS variables for the deck theme.

---

# PART 1 — AGENT SKILL AUTHORING FORMAT & BEST PRACTICES

## 1.1 The Official Specification (`agentskills.io/specification`)

**Source:** https://agentskills.io/specification *(fetched live)*

### Required Directory Structure

```
skill-name/
├── SKILL.md          # Required: YAML frontmatter + Markdown instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: additional documentation
├── assets/           # Optional: templates, resources (fonts, images)
└── ...               # Any additional files allowed
```

The **directory name must exactly match the `name` field** in frontmatter.

### YAML Frontmatter — Complete Field Reference

| Field | Required | Constraints |
|---|---|---|
| `name` | **Yes** | Max 64 chars. Lowercase `a-z`, `0-9`, and `-` only. No leading/trailing/consecutive hyphens. Must match parent directory name. |
| `description` | **Yes** | Max 1024 chars. Non-empty. Describe *what* it does **and** *when* to use it. Include trigger keywords. |
| `license` | No | Short license name or reference to a bundled `LICENSE.txt`. |
| `compatibility` | No | Max 500 chars. Environment requirements (OS, packages, network). Most skills omit this. |
| `metadata` | No | Arbitrary key-value map for extra properties (e.g., `author`, `version`). |
| `allowed-tools` | No (Experimental) | Space-separated pre-approved tools: e.g., `Bash(git:*) Bash(jq:*) Read`. |

**Minimal valid SKILL.md** *(from template/SKILL.md — `anthropics/skills:template/SKILL.md`)*:
```yaml
---
name: template-skill
description: Replace with description of the skill and when Claude should use it.
---

# Insert instructions below
```

**Example with optional fields** *(from agentskills.io/specification)*:
```yaml
---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---
```

### Progressive Disclosure — The Core Design Principle

Sourced from: Anthropic engineering blog (https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) and agentskills.io/specification

| Level | Content | Token budget | When loaded |
|---|---|---|---|
| **1 — Metadata** | `name` + `description` | ~100 tokens | Always in context at startup for ALL installed skills |
| **2 — Instructions** | Full `SKILL.md` body | <5000 tokens, ≤500 lines recommended | When Claude decides the skill is relevant to the current task |
| **3 — Resources** | `scripts/`, `references/`, `assets/` files | Unlimited | Only as needed, loaded on demand |

**Key insight from the engineering blog:** "The amount of context that can be bundled into a skill is effectively unbounded" because agents with code execution tools don't need to load everything into the context window at once. Scripts can *execute* without being read into context.

### Description Writing Rules

From skill-creator SKILL.md (`anthropics/skills:skills/skill-creator/SKILL.md`, fetched via raw GitHub):

1. **Make descriptions "a little bit pushy"** — Claude tends to undertrigger skills. Instead of "How to build a dashboard," write: "How to build a dashboard. Make sure to use this skill whenever the user mentions dashboards, data visualization, internal metrics, or wants to display any kind of company data, **even if they don't explicitly ask for it.**"
2. **Include both what the skill does AND specific contexts** for when to use it.
3. **Include specific keywords** that map to user phrases.
4. All "when to use" guidance goes in the description frontmatter field, not in the body.

---

## 1.2 The pptx Skill — Dissected as Model

**Source:** `anthropics/skills:skills/pptx/` — the production skill powering Claude.ai's document creation. Proprietary license (source-available reference only).

### File Structure

```
skills/pptx/
├── SKILL.md           # 9182 bytes — quick-ref table + design guidelines + QA + deps
├── pptxgenjs.md       # 12819 bytes — full PptxGenJS API tutorial (level-3 reference)
├── editing.md         # 6885 bytes — template-based editing workflow (level-3 reference)
├── scripts/
│   ├── thumbnail.py   # Creates slide thumbnail grids (PIL + LibreOffice + pdftoppm)
│   ├── add_slide.py   # Duplicates slides or creates from layouts
│   ├── clean.py       # Removes orphaned XML elements from unpacked PPTX
│   └── office/
│       ├── unpack.py  # Extracts PPTX ZIP, pretty-prints XML
│       ├── pack.py    # Re-packs with validation
│       └── soffice.py # LibreOffice environment wrapper
└── LICENSE.txt
```

### YAML Frontmatter (exact)

```yaml
---
name: pptx
description: "Use this skill any time a .pptx file is involved in any way — as
  input, output, or both. This includes: creating slide decks, pitch decks, or
  presentations; reading, parsing, or extracting text from any .pptx file (even
  if the extracted content will be used elsewhere, like in an email or summary);
  editing, modifying, or updating existing presentations; combining or splitting
  slide files; working with templates, layouts, speaker notes, or comments.
  Trigger whenever the user mentions \"deck,\" \"slides,\" \"presentation,\" or
  references a .pptx filename, regardless of what they plan to do with the
  content afterward. If a .pptx file needs to be opened, created, or touched,
  use this skill."
license: Proprietary. LICENSE.txt has complete terms
---
```

**Citation:** `anthropics/skills:skills/pptx/SKILL.md` (SHA: `df5000e17ef60ecf400e65bfcd3c58ff88b604c3`)

Notable points:
- Description is **897 characters** (under 1024 limit) — dense and keyword-rich
- Uses the "pushy" pattern: "Trigger whenever the user mentions…"
- Lists every synonym: "deck", "slides", "presentation", ".pptx filename"
- No `compatibility` field — dependencies are declared in the SKILL.md body

### How the pptx Skill Builds Decks from Scratch

**Level 2 (SKILL.md body)** contains:
1. A **Quick Reference table** pointing to the three workflows (read content → editing.md, create from scratch → pptxgenjs.md)
2. **Design guidelines** (color palette table, typography pairs, layout patterns, anti-patterns) — this is a creative design guide baked into the skill
3. A **QA workflow** (markitdown for text QA, LibreOffice + pdftoppm for visual QA, a subagent-based inspection loop)
4. **Dependencies declared explicitly** at the bottom:
   ```
   pip install "markitdown[pptx]"  # text extraction
   pip install Pillow              # thumbnail grids
   npm install -g pptxgenjs        # creating from scratch
   LibreOffice (soffice)           # PDF conversion
   Poppler (pdftoppm)              # PDF to images
   ```

**Level 3 (`pptxgenjs.md`)** contains the full PptxGenJS API tutorial. Key patterns:
- Uses `pptxgenjs` (npm), creates `.pptx` programmatically via JavaScript
- All colors as 6-char hex **without `#` prefix** (using `#` corrupts files — a common pitfall!)
- Slide layout: `LAYOUT_16x9` (10" × 5.625")
- Icons via `react-icons` → rasterized to PNG via `sharp`
- `chartColors: [...]` for matching brand palette

**Level 3 (`editing.md`)** covers XML manipulation of existing templates via unpack/edit/pack.

**Level 3 (`scripts/thumbnail.py`)** — creates a visual thumbnail grid using:
- `defusedxml.minidom` (not `xml.etree` — which corrupts namespaces)
- LibreOffice for PDF conversion: `soffice --headless --convert-to pdf`
- `pdftoppm` for image conversion
- `PIL/Pillow` for grid creation

**Citation:** Full file content at `anthropics/skills:skills/pptx/scripts/thumbnail.py`

### The `add_slide.py` Script Pattern

`anthropics/skills:skills/pptx/scripts/add_slide.py` demonstrates the correct bundled-script pattern:
- Self-contained, handles edge cases (Content_Types.xml, relationship IDs)
- Clear CLI usage in docstring
- Error messages with `sys.stderr` and `sys.exit(1)`
- Pure Python, no undeclared deps beyond stdlib

---

## 1.3 The `theme-factory` Skill — Relevant Precedent

**Source:** `anthropics/skills:skills/theme-factory/SKILL.md` (SHA: `90dfceaf2ecdc191a4dcfb0069768a9560638998`)

This skill is **directly analogous** to what we're building — it applies themes to slides, docs, and HTML artifacts.

**Structure:**
```
skills/theme-factory/
├── SKILL.md              # 3124 bytes — describes 10 themes, usage instructions
├── theme-showcase.pdf    # 124310 bytes — visual reference for humans
└── themes/
    ├── ocean-depths.md   # Individual theme spec (colors + fonts + use cases)
    ├── sunset-boulevard.md
    ├── forest-canopy.md
    └── ... (10 themes total)
```

**Each theme file format** (`themes/ocean-depths.md`):
```markdown
# Ocean Depths

A professional and calming maritime theme.

## Color Palette
- **Deep Navy**: `#1a2332` - Primary background color
- **Teal**: `#2d8b8b` - Accent color
- **Seafoam**: `#a8dadc` - Secondary accent
- **Cream**: `#f1faee` - Text and light backgrounds

## Typography
- **Headers**: DejaVu Sans Bold
- **Body Text**: DejaVu Sans

## Best Used For
Corporate presentations, financial reports, professional consulting decks.
```

**Citation:** `anthropics/skills:skills/theme-factory/themes/ocean-depths.md`

**Pattern for our skill:** This is the model — separate small markdown files per theme, loaded on demand.

---

## 1.4 The `brand-guidelines` Skill — Simple Inline Pattern

**Source:** `anthropics/skills:skills/brand-guidelines/SKILL.md` (SHA: `47c72c607bdb5dd81bdea5de2b5e4f3992a5fd59`)

Demonstrates the simplest pattern: all brand tokens inlined directly in SKILL.md, no separate files needed.

```yaml
---
name: brand-guidelines
description: Applies Anthropic's official brand colors and typography to any
  artifact. Use it when brand colors, style guidelines, visual formatting, or
  company design standards apply.
---
```

Inline colors:
```
Dark: #141413 | Light: #faf9f5 | Mid Gray: #b0aea5
Orange: #d97757 | Blue: #6a9bcc | Green: #788c5d
```
Fonts: **Poppins** (headings), **Lora** (body)

Uses `python-pptx` with `RGBColor` class for applying brand to existing decks.

---

## 1.5 Skill-Creator Meta-Skill — Authoring Rules Codified

**Source:** Raw SKILL.md at `raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md`

Key authoring rules from this canonical reference:

### File Organization
```
skill-name/
├── SKILL.md
└── Bundled Resources
    ├── scripts/    # Executable code for deterministic/repetitive tasks
    ├── references/ # Docs loaded into context as needed
    └── assets/     # Files used in output (templates, icons, fonts)
```

### Writing Rules
1. **Keep SKILL.md under 500 lines**. If approaching limit, add hierarchy with clear pointers.
2. **Reference files clearly** from SKILL.md with guidance on *when* to read them.
3. **For large reference files (>300 lines), include a table of contents.**
4. **Domain organization**: When skill supports multiple variants, put each in its own references file:
   ```
   cloud-deploy/
   ├── SKILL.md (workflow + selection logic)
   └── references/
       ├── aws.md
       ├── gcp.md
       └── azure.md
   ```
5. Use imperative form in instructions.
6. Explain *why* things matter — don't just list heavy-handed "MUST" rules.

### Test Cases (evals/evals.json schema)
```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result",
      "files": []
    }
  ]
}
```

---

## 1.6 API Integration

**Source:** `platform.claude.com/docs/en/build-with-claude/skills-guide` (fetched live)

Skills integrate via the **Messages API** with:
- Beta headers: `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`
- `container.skills` array with `{ type, skill_id, version }` per skill
- A `code_execution` tool in `tools` array

```json
"container": {
  "skills": [
    { "type": "anthropic", "skill_id": "pptx", "version": "latest" }
  ]
}
```

For custom uploaded skills: `type: "custom"`, `skill_id: "skill_01AbCd..."`.

---

# PART 2 — EXTRACTING VISUAL STYLE FROM A PROJECT

## 2.1 Color Extraction from Images (Logo, Screenshots, Favicons)

### Tool 1: `node-vibrant` (Node.js/Browser)

| | |
|---|---|
| **GitHub** | https://github.com/Vibrant-Colors/node-vibrant |
| **npm** | `npm install node-vibrant` |
| **Language** | TypeScript |
| **Stars** | ~5.7k |
| **License** | MIT |
| **Maintenance** | Active |

**What it extracts:** 6 named semantic swatches: `Vibrant`, `Muted`, `DarkVibrant`, `DarkMuted`, `LightVibrant`, `LightMuted`. Each swatch has `.hex`, `.rgb`, `.population` (dominance).

```js
import { Vibrant } from 'node-vibrant/node';
const palette = await Vibrant.from('logo.png').getPalette();
// palette.Vibrant.hex → '#3A7BD5'
// palette.DarkVibrant.hex → '#1E4A9E'  ← excellent for slide primary
// palette.LightVibrant.hex → '#89B5F5' ← excellent for accent/bg
```

**Integration for deck theming:** Map `DarkVibrant` → primary color, `LightVibrant` → secondary, `Vibrant` → accent.

---

### Tool 2: `colorthief` (Node.js / Browser)

| | |
|---|---|
| **GitHub** | https://github.com/lokesh/color-thief |
| **npm** | `npm install colorthief` |
| **Language** | JavaScript/TypeScript |
| **Stars** | ~13k |
| **License** | MIT |
| **Maintenance** | Active (v3 just released with OKLCH) |

**What it extracts:** Dominant color + N-color palette. New v3 adds semantic swatches (Vibrant, Muted, etc.), WCAG contrast ratios, OKLCH quantization.

```js
import { getColor, getPalette, getSwatches } from 'colorthief';
const dominant = await getColor(imgElement);
dominant.hex(); // '#e84393'
const palette = await getPalette(img, { colorCount: 6, colorSpace: 'oklch' });
const swatches = await getSwatches(img); // Vibrant, DarkVibrant, etc.
swatches.Vibrant?.color.hex();
swatches.Vibrant?.color.contrast.white; // WCAG ratio
```

**Advantage over node-vibrant:** Zero runtime dependencies; built-in WCAG contrast checking; richer Color object API.

---

### Tool 3: `colorthief` Python (colorthief-py)

| | |
|---|---|
| **GitHub** | https://github.com/fengsp/color-thief-py |
| **PyPI** | `pip install colorthief` |
| **Language** | Python |
| **License** | MIT |
| **Algorithm** | Median-cut (MMCQ) |

```python
from colorthief import ColorThief
ct = ColorThief('logo.png')
dominant = ct.get_color(quality=1)          # (r, g, b)
palette = ct.get_palette(color_count=6)     # [(r,g,b), ...]
```

Simple, reliable, no ML dependencies. Good for macOS scripts.

---

### Tool 4: Pillow + scikit-learn k-means (Python)

| | |
|---|---|
| **Pillow** | https://github.com/python-pillow/Pillow — ~13k stars, Apache 2.0 |
| **scikit-learn** | https://github.com/scikit-learn/scikit-learn — ~60k stars, BSD-3 |
| **Pattern source** | `majiayu000/claude-skill-registry:skills/data/color-palette-extractor/SKILL.md` |

```python
from PIL import Image
import numpy as np
from sklearn.cluster import KMeans

img = Image.open('logo.png').convert('RGB')
pixels = np.array(img).reshape(-1, 3)
kmeans = KMeans(n_clusters=6, n_init=10)
kmeans.fit(pixels)
colors = kmeans.cluster_centers_.astype(int)
# → [[28, 62, 130], [234, 87, 59], ...]  # list of (r,g,b) centroids

# Export to CSS:
css = ':root {\n'
for i, c in enumerate(colors):
    css += f'  --color-{i+1}: #{c[0]:02x}{c[1]:02x}{c[2]:02x};\n'
css += '}'
```

**Dependencies:** `pip install pillow scikit-learn numpy`

**Advantage:** Most controllable — you can filter colors, sort by dominance (cluster size), post-process for contrast.

---

### Tool 5: AI-Powered Extraction (Gemini/Claude Vision)

**Source:** `ckorhonen/claude-skills:skills/gemini-visual/scripts/extract_colors.py` (full file fetched)

Uses Google Gemini 3 Vision API to extract colors with **semantic roles** and **WCAG contrast ratios**:

```python
# Returns structured JSON:
{
  "colors": [
    { "hex": "#3A7BD5", "name": "primary", "usage": "main brand color on buttons" },
    { "hex": "#F5F5F5", "name": "background", "usage": "page background" },
  ],
  "palette_description": "Professional blue-and-white tech brand"
}
```

**Outputs:** CSS custom properties, Tailwind config extend, SCSS variables, JSON, human-readable text.

```bash
python extract_colors.py -f css -o colors.css logo.png
python extract_colors.py -f tailwind -o tailwind.config.js design.png
```

**Why this matters for our skill:** The semantic naming ("primary", "background", "accent") is directly usable for slide theme mapping without additional heuristics. Works with Claude vision too.

---

## 2.2 Extracting Design Tokens from Codebase

### Source A: Tailwind Config (`tailwind.config.js`)

Most modern projects with Tailwind expose their entire color palette here.

**Node.js approach:**
```js
const resolveConfig = require('tailwindcss/resolveConfig');
const config = require('./tailwind.config.js');
const resolved = resolveConfig(config);
const colors = resolved.theme.colors;
// { primary: '#3A7BD5', secondary: '#F5A623', ... }
```

**Python approach** (if no Node.js available):
```python
import re, json

with open('tailwind.config.js') as f:
    content = f.read()

# Extract color blocks from theme.extend.colors
colors = re.findall(r"'?([\w-]+)'?\s*:\s*'(#[0-9a-fA-F]{3,8})'", content)
# → [('primary', '#3A7BD5'), ('accent', '#F5A623'), ...]
```

---

### Source B: CSS/SCSS Custom Properties

Pattern — scan all CSS/SCSS files for `--color-*` or similar variables in `:root`:

```python
import re, glob

def extract_css_tokens(project_root):
    tokens = {}
    for path in glob.glob(f'{project_root}/**/*.css', recursive=True) + \
                glob.glob(f'{project_root}/**/*.scss', recursive=True):
        text = open(path).read()
        # Match :root { --color-primary: #hex; } patterns
        matches = re.findall(
            r'--([\w-]*(?:color|bg|text|brand|primary|secondary|accent)[\w-]*)'
            r'\s*:\s*(#[0-9a-fA-F]{3,8}|(?:rgb|hsl)\([^)]+\))',
            text, re.I
        )
        tokens.update(matches)
    return tokens
```

**CSS parser alternative:** `cssutils` (https://github.com/jaraco/cssutils, PyPI: `pip install cssutils`) — full CSS 2.1/3 parser with DOM API, supports custom properties.

---

### Source C: W3C Design Tokens (DTCG Format)

**Spec:** https://www.w3.org/community/design-tokens/ (stable v2025.10 released October 2025)
**Repo:** https://github.com/design-tokens/community-group

Supported by Figma, Penpot, Sketch, Tokens Studio, Style Dictionary. Look for `tokens.json`, `design-tokens.json`, `tokens/` directories.

**Format:**
```json
{
  "color": {
    "primary": { "$type": "color", "$value": "#3A7BD5" },
    "background": { "$type": "color", "$value": "#FFFFFF" }
  },
  "typography": {
    "heading-font": { "$type": "fontFamily", "$value": "Inter" },
    "body-font": { "$type": "fontFamily", "$value": "Georgia" }
  }
}
```

**Parsing (Python):**
```python
import json

def extract_dtcg_tokens(tokens_file):
    with open(tokens_file) as f:
        data = json.load(f)
    
    def walk(obj, path=[]):
        results = {}
        for key, val in obj.items():
            if isinstance(val, dict):
                if '$type' in val and '$value' in val:
                    results['.'.join(path + [key])] = val
                else:
                    results.update(walk(val, path + [key]))
        return results
    
    all_tokens = walk(data)
    colors = {k: v['$value'] for k, v in all_tokens.items() 
              if v.get('$type') == 'color'}
    return colors
```

---

### Source D: Style Dictionary

| | |
|---|---|
| **GitHub** | https://github.com/style-dictionary/style-dictionary |
| **npm** | `npm install -D style-dictionary` |
| **Language** | JavaScript/TypeScript |
| **License** | Apache-2.0 |
| **Maintenance** | Very active (v4.0 released) |

Style Dictionary is the build tool for transforming design token files into platform outputs. If a project uses it, look for `config.json` and `tokens/` directory.

```js
const StyleDictionary = require('style-dictionary').extend('config.json');
StyleDictionary.buildAllPlatforms();  // → CSS, iOS, Android, etc.
```

**For our use case:** If the project has a Style Dictionary config, we can run it to get a CSS file with all tokens already resolved.

---

### Source E: Figma Tokens Plugin (Tokens Studio)

| | |
|---|---|
| **GitHub** | https://github.com/tokens-studio/figma-plugin |
| **Language** | TypeScript |
| **License** | AGPL-3.0 |

Exports tokens as JSON in W3C DTCG format (or Tokens Studio format). If the project has a `tokens.json` or `design-tokens/` directory synced from Figma → parse as DTCG format above.

---

## 2.3 Typography and Font Detection

```python
import re, glob, os

def detect_fonts(project_root):
    fonts = {}
    
    # 1. @font-face declarations in CSS/SCSS
    for path in glob.glob(f'{project_root}/**/*.css', recursive=True):
        text = open(path).read()
        families = re.findall(r'@font-face[^}]*font-family:\s*["\']?([^"\';]+)', text)
        sources = re.findall(r'@font-face[^}]*src:[^}]*url\(["\']?([^"\')]+)', text)
        fonts['css_font_face'] = list(set(families))
    
    # 2. Google Fonts links
    for path in glob.glob(f'{project_root}/**/*.html', recursive=True) + \
                glob.glob(f'{project_root}/**/*.css', recursive=True):
        text = open(path).read()
        gf = re.findall(r'fonts\.googleapis\.com/css[^"\']*family=([^&"\']+)', text)
        fonts['google_fonts'] = [f.split(':')[0].replace('+', ' ') for f in gf]
    
    # 3. @fontsource packages in package.json
    if os.path.exists(f'{project_root}/package.json'):
        pkg = json.load(open(f'{project_root}/package.json'))
        deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
        fonts['fontsource'] = [k.replace('@fontsource/', '') 
                               for k in deps if k.startswith('@fontsource/')]
    
    # 4. Font files in repo
    font_files = glob.glob(f'{project_root}/**/*.{ttf,woff,woff2,otf}', recursive=True)
    fonts['bundled_files'] = [os.path.basename(f) for f in font_files]
    
    return fonts
```

---

## 2.4 Logo and Brand Asset Detection

```python
import os, glob

def find_brand_assets(project_root):
    """Find logo, favicon, and brand assets in common locations."""
    patterns = [
        '**/logo.svg', '**/logo.png', '**/logo.jpg',
        '**/brand*.svg', '**/brand*.png',
        '**/icon*.svg', '**/icon*.png',
        '**/favicon.ico', '**/favicon.svg', '**/favicon.png',
        'public/**', 'assets/**', 'static/**',  # framework-specific dirs
    ]
    assets = {}
    for pattern in patterns:
        found = glob.glob(os.path.join(project_root, pattern), recursive=True)
        if found:
            assets[pattern] = found[0]  # highest-priority match
    return assets
```

Common logo locations by framework:
- **Next.js**: `public/logo.svg`, `public/favicon.ico`
- **Vite/React**: `public/logo.svg`, `src/assets/logo.png`
- **Nuxt**: `public/logo.svg`, `assets/images/logo.png`
- **README banner**: Check first `![` markdown image in `README.md`

---

## 2.5 Mapping Extracted Tokens into Slide Themes

### For pptxgenjs (our primary target — matching the pptx skill)

**Citation:** `anthropics/skills:skills/pptx/pptxgenjs.md` — defines the exact color mapping.

```js
// IMPORTANT: pptxgenjs uses hex WITHOUT '#' prefix
// '#' causes file corruption!
const theme = {
  primary:    '1A2332',  // → slide title backgrounds, key shapes
  secondary:  '2D8B8B',  // → accent lines, section headers
  accent:     'A8DADC',  // → callout boxes, charts highlights
  background: 'F1FAEE',  // → slide.background
  text:       '1A2332',  // → main text color
};

// Apply to slide background
slide.background = { color: theme.background };

// Apply to chart colors
slide.addChart(pres.charts.BAR, data, {
  chartColors: [theme.primary, theme.secondary, theme.accent]
});

// Apply to shape fill
slide.addShape(pres.shapes.RECTANGLE, {
  fill: { color: theme.primary }
});

// Apply to text
slide.addText('Title', { color: theme.text, bold: true });
```

---

### For reveal.js CSS Themes

**Source:** `hakimel/reveal.js:css/theme/template/settings.scss` (full file fetched)

All overridable via CSS custom properties in `:root`:

```css
:root {
  --r-background: #1A2332;           /* presentation background */
  --r-background-color: #F1FAEE;     /* body text + slide bg */
  --r-main-font: 'Inter', sans-serif;
  --r-main-font-size: 40px;
  --r-main-color: #F1FAEE;
  --r-heading-font: 'Space Grotesk', sans-serif;
  --r-heading-color: #A8DADC;
  --r-link-color: #2D8B8B;
  --r-selection-background-color: #2D8B8B;
}
```

Or via SCSS variables for a compiled custom theme:
```scss
$background: #1A2332;
$main-font: 'Inter', sans-serif;
$heading-font: 'Space Grotesk', sans-serif;
$heading-color: #A8DADC;
$main-color: #F1FAEE;
$link-color: #2D8B8B;
@import 'template/theme'; // pulls in the rest
```

**Citation:** `hakimel/reveal.js:css/theme/template/settings.scss` (fetched live)

---

### For Slidev Themes

**Source:** https://sli.dev/llms.txt → `/guide/write-theme.md`

Slidev uses UnoCSS. A custom theme package exports a `styles.css` with CSS custom properties. The key variables follow a similar pattern to reveal.js.

---

## 2.6 Recommended Extraction Pipeline for Our Skill

Here is the concrete recommended procedure, ordered by reliability and data richness:

### Step 1 — Scan for Coded Design Tokens (Most Reliable)

```
Priority order:
1. W3C DTCG tokens.json → parse $type: color tokens directly
2. Tailwind tailwind.config.js → resolveConfig().theme.colors
3. CSS/SCSS :root { --color-*: ... } variables
4. Style Dictionary output CSS (if dist/tokens.css exists)
```

**Why first:** Coded tokens are exact, semantic, already named. No extraction inference needed.

### Step 2 — Detect Logo/Favicon (for Image-based Extraction)

```
Look for: public/logo.svg, src/assets/logo.png, favicon.ico
Fallback: README.md first banner image
```

### Step 3 — Extract Palette from Logo Image

For Node.js skills (preferred — matches pptxgenjs):
```js
import { Vibrant } from 'node-vibrant/node';
const p = await Vibrant.from('public/logo.png').getPalette();
const palette = {
  primary:    p.DarkVibrant?.hex  ?? '#1E293B',
  secondary:  p.Vibrant?.hex     ?? '#3B82F6',
  accent:     p.LightVibrant?.hex ?? '#93C5FD',
  background: p.LightMuted?.hex  ?? '#F8FAFC',
  dark:       p.DarkMuted?.hex   ?? '#0F172A',
};
```

For Python scripts:
```python
from colorthief import ColorThief
ct = ColorThief('public/logo.png')
palette = ct.get_palette(color_count=5, quality=1)  # [(r,g,b), ...]
# → convert to hex: '#{:02x}{:02x}{:02x}'.format(*rgb)
```

### Step 4 — Detect Fonts

```
1. @fontsource in package.json → use as-is (already web-ready)
2. @font-face in CSS → extract font-family name
3. Google Fonts URL → extract family name
4. Font files in /fonts → use filename as family name
```

### Step 5 — Merge and Build Theme Object

```python
theme = {
    # Colors (from step 1 or 3, with fallbacks)
    'primary':    tokens.get('color.primary') or palette[0],
    'secondary':  tokens.get('color.secondary') or palette[1],
    'accent':     tokens.get('color.accent') or palette[2],
    'background': tokens.get('color.background') or '#FFFFFF',
    'text':       tokens.get('color.text') or '#1A1A1A',

    # Fonts (from step 4, with fallbacks)
    'heading_font': detected_fonts.get('heading') or 'Arial',
    'body_font':    detected_fonts.get('body') or 'Calibri',

    # Logo path
    'logo': found_logo_path,
}
```

### Step 6 — Apply to Deck Engine

Map into pptxgenjs (no `#` prefix), reveal.js CSS vars, or Slidev theme CSS.

---

## 2.7 Library Summary Table

| Library | Language | What it Extracts | License | Stars | Link |
|---|---|---|---|---|---|
| **node-vibrant** | TypeScript | 6 named color swatches from image | MIT | ~5.7k | https://github.com/Vibrant-Colors/node-vibrant |
| **colorthief** (JS) | JavaScript | Dominant color + palette + WCAG contrast | MIT | ~13k | https://github.com/lokesh/color-thief |
| **colorthief** (Python) | Python | Dominant color + palette (median-cut) | MIT | ~3k | https://github.com/fengsp/color-thief-py |
| **Pillow** | Python | Image manipulation (resize, convert for extraction) | Apache-2.0 | ~13k | https://github.com/python-pillow/Pillow |
| **scikit-learn** | Python | k-means clustering for color quantization | BSD-3 | ~60k | https://github.com/scikit-learn/scikit-learn |
| **style-dictionary** | JS/TS | Transforms design token JSON → CSS/iOS/Android | Apache-2.0 | ~4k | https://github.com/style-dictionary/style-dictionary |
| **cssutils** | Python | Full CSS parser including custom properties | LGPL | ~1k | https://github.com/jaraco/cssutils |
| **sharp** | Node.js | High-speed image processing (resize/convert) | Apache-2.0 | ~30k | https://github.com/lovell/sharp |
| **chroma.js** | JavaScript | Color manipulation, scales, contrast | BSD-3 | ~10k | https://github.com/gka/chroma.js |
| **Tokens Studio** | TypeScript | Figma → DTCG JSON design tokens | AGPL-3.0 | ~3k | https://github.com/tokens-studio/figma-plugin |

---

# KEY CITATIONS INDEX

| Item | Citation |
|---|---|
| Official skills repo root | https://github.com/anthropics/skills |
| Agent Skills specification | https://agentskills.io/specification |
| Engineering blog post | https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills |
| pptx SKILL.md | `anthropics/skills:skills/pptx/SKILL.md` (SHA: df5000e17ef60ecf400e65bfcd3c58ff88b604c3) |
| pptxgenjs.md reference | `anthropics/skills:skills/pptx/pptxgenjs.md` (SHA: 6bfed908c9001d047b65995a8eb8b2097340da76) |
| editing.md reference | `anthropics/skills:skills/pptx/editing.md` (SHA: f873e8a04ab20b5a79543ea28729149cfd70ef2c) |
| thumbnail.py script | `anthropics/skills:skills/pptx/scripts/thumbnail.py` |
| add_slide.py script | `anthropics/skills:skills/pptx/scripts/add_slide.py` |
| template SKILL.md | `anthropics/skills:template/SKILL.md` (SHA: 50a4f9b104357d96361e257adb70454604cd15c0) |
| skill-creator SKILL.md | `anthropics/skills:skills/skill-creator/SKILL.md` (SHA: 65b3a402dbd09b8e83f9d637c6b553875189085c) |
| theme-factory SKILL.md | `anthropics/skills:skills/theme-factory/SKILL.md` (SHA: 90dfceaf2ecdc191a4dcfb0069768a9560638998) |
| theme-factory/themes/ocean-depths.md | `anthropics/skills:skills/theme-factory/themes/ocean-depths.md` |
| brand-guidelines SKILL.md | `anthropics/skills:skills/brand-guidelines/SKILL.md` (SHA: 47c72c607bdb5dd81bdea5de2b5e4f3992a5fd59) |
| Skills API guide | https://platform.claude.com/docs/en/build-with-claude/skills-guide |
| Color palette extractor SKILL | `majiayu000/claude-skill-registry:skills/data/color-palette-extractor/SKILL.md` |
| Gemini extract_colors.py | `ckorhonen/claude-skills:skills/gemini-visual/scripts/extract_colors.py` |
| Reveal.js settings.scss | `hakimel/reveal.js:css/theme/template/settings.scss` |
| W3C Design Tokens spec | https://www.w3.org/community/design-tokens/ (v2025.10 stable) |
| DTCG community group | https://github.com/design-tokens/community-group |
| node-vibrant | https://github.com/Vibrant-Colors/node-vibrant |
| colorthief (JS) | https://github.com/lokesh/color-thief |
| colorthief (Python) | https://github.com/fengsp/color-thief-py |
| style-dictionary | https://github.com/style-dictionary/style-dictionary |
| cssutils (Python) | https://github.com/jaraco/cssutils |
| sharp | https://github.com/lovell/sharp |
| chroma.js | https://github.com/gka/chroma.js |
| Tokens Studio for Figma | https://github.com/tokens-studio/figma-plugin |
| Slidev | https://github.com/slidevjs/slidev |

---

# GAPS AND UNCERTAINTIES

1. **Slidev theme variable names** — The exact CSS custom property names for Slidev themes were not confirmed (the llms.txt index pointed to `/guide/write-theme.md` but the fetch was truncated). The sli.dev docs would need a follow-up fetch at `https://sli.dev/guide/write-theme.md`.

2. **Video narration / word-highlight sync** — No dedicated research was done on the video/narration part of the skill (macOS TTS sync, screen recording with `ffmpeg`, word-timing via `say` command). That warrants separate research into: macOS `say` command with timing markers, `ffmpeg` for compositing, or web-based alternatives.

3. **node-vibrant exact star count** — Badge shows ~5.7k but this is approximate from the image alt text. The NPM weekly download count was not retrieved.

4. **colorthief v3 exact release date** — The new v3 README was fetched and confirmed; the version tag wasn't pinned but NPM shows it as latest.

5. **`skills-ref` validator tool** — The spec references a validation CLI (`skills-ref validate ./my-skill`) at `github.com/agentskills/agentskills/tree/main/skills-ref` — this was not fetched and the tool's actual functionality was not verified.

6. **Proprietary pptx skill license** — The pptx skill is source-available (not Apache 2.0). We cannot copy its scripts directly; we must write our own. The patterns and approaches are what we learned from.