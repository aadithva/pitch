# deck-to-video (skill)

Turn a project into a **brand-styled, self-explanatory deck** — and (progressively)
a **narrated, word-highlighted video**. This folder is the runnable Agent Skill;
see `SKILL.md` for the agent-facing workflow.

## Install
```bash
npm install
npx playwright install chromium   # for PDF/PNG export
```

## Quickstart (Phase 1)
```bash
# 1) Extract the project's visual style → theme.json + theme.css
node scripts/extract_style.mjs examples/sample-brand --out build/sample-brand

# 2) Render a deck from a slides spec + theme → self-contained deck.html
node scripts/render_deck.mjs examples/demo-project/slides.json build/sample-brand/theme.json \
  --out build/sample-brand/deck.html

# 3) Export a PDF and per-slide PNG frames
node scripts/export_pdf.mjs build/sample-brand/deck.html \
  --out build/sample-brand/deck.pdf --png build/sample-brand/frames
```
Open `build/sample-brand/deck.html` in a browser, or review the PNG frames.

## What's here
| Path | Purpose |
|------|---------|
| `SKILL.md` | Agent-facing workflow + quick reference |
| `scripts/extract_style.mjs` | Project → `theme.json`/`theme.css` (tokens, logo palette, fonts) |
| `scripts/render_deck.mjs` | `slides.json` + theme → self-contained `deck.html` (+ word manifest) |
| `scripts/export_pdf.mjs` | `deck.html` → `deck.pdf` (+ optional PNG frames) |
| `scripts/lib/` | `theme.mjs`, `deck.mjs` (rendering), `capture.mjs` (headless capture) |
| `assets/` | reveal.js template, `base.css`, `highlight.css`, `default_theme.json` |
| `schemas/` | `slides.schema.json`, `project_brief.schema.json` |
| `references/` | blueprint, narration rules, theming, video pipeline |
| `examples/` | `demo-project/` (slides), `sample-brand/` (style extraction) |
| `evals/` | trigger/output checks |

## Status
Phase 1 (deck generation + style extraction) is implemented and verified.
Narration and video (Phases 3–4) are specified in `references/` and the
repository `plan/`.

## License
MIT.
