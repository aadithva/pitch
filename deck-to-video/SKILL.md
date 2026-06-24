---
name: deck-to-video
description: >-
  Use this skill whenever the user wants to turn a project, codebase, design, or
  brief into a presentation deck and/or a narrated explainer video. Triggers on:
  "make a deck", "slides", "presentation", "pitch deck", "explainer video",
  "demo video", "voiceover", "narrate my project", "walkthrough video", "turn
  this repo into slides/a video". It generates a brand-styled, self-explanatory
  slide deck (HTML + PDF) by extracting the project's own colors and fonts, and
  (in later phases) an AI-narrated MP4 where spoken words highlight on the slide
  karaoke-style. Use any time a deck, slides, or a narrated video is requested.
license: MIT
---

# deck-to-video

Turn a project into a **self-explanatory, brand-styled deck** and (progressively)
a **narrated, word-highlighted video**. Built for designers and "vibecoders" who
want a polished explainer without a timeline editor.

## What it produces
- `deck.html` — a single self-contained reveal.js deck, styled in the project's brand.
- `deck.pdf` — a shareable PDF (+ optional per-slide PNG frames).
- `theme.json` / `theme.css` — the extracted visual style (reusable).
- *(Phase 3+)* `narration/` — per-slide script + audio + word timings.
- *(Phase 3+)* `final.mp4` — the narrated, word-highlighted video.

> **Status:** Phase 1 (deck generation) + style extraction are implemented.
> Narration and video are specified in `references/` and the project plan; see
> "Roadmap" below.

## Quick reference

| Goal | Do this | Details |
|------|---------|---------|
| Understand the project | Read its README/manifest/source → fill `schemas/project_brief.schema.json` | `references/authoring-decks.md` |
| Adopt the project's look | `node scripts/extract_style.mjs <projectDir> --out <dir>` | `references/theming.md` |
| Plan the slides | Write `slides.json` per the blueprint + `schemas/slides.schema.json` | `references/deck-blueprint.md` |
| Render the deck | `node scripts/render_deck.mjs <slides.json> <theme.json> --out deck.html` | this file |
| Export PDF / frames | `node scripts/export_pdf.mjs deck.html --out deck.pdf --png frames/` | this file |
| Write narration | Add `narration` to each slide (rules) | `references/narration-rules.md` |
| Make the video | *(Phase 3+)* TTS + capture + ffmpeg | `references/video-pipeline.md` |

## Workflow (5 stages)

### 1. Understand the project
Read the project (README, `package.json`/manifest, key source, `docs/`). Produce a
`project_brief.json` matching `schemas/project_brief.schema.json`. Its fields map
1:1 onto the deck blueprint (problem → users → insight → solution → how → features
→ results → next → cta).

### 2. Extract the visual style
```bash
node scripts/extract_style.mjs <projectDir> --out build/<name>
```
Scans design tokens (DTCG `tokens.json`, CSS `:root` vars, Tailwind config), the
logo (palette via node-vibrant), and fonts (`@font-face`, Google Fonts,
`@fontsource`). Writes `theme.json` + `theme.css`. Keeps a professional **dark**
base and adopts the brand's primary/secondary/accent + fonts (and a dark brand
background if present). Use `--mode light` for a light deck. See
`references/theming.md`.

### 3. Generate the deck
Turn `project_brief.json` into a `slides.json` (array of typed slides) following
`references/deck-blueprint.md` and `schemas/slides.schema.json`. Then:
```bash
node scripts/render_deck.mjs path/to/slides.json build/<name>/theme.json --out build/<name>/deck.html
```
This emits a self-contained `deck.html` (reveal.js + theme inlined) where **every
on-slide word is wrapped in `<span data-w>`** for later karaoke highlighting, plus
a `deck.words.json` manifest.

### 4. Export deliverables
```bash
node scripts/export_pdf.mjs build/<name>/deck.html --out build/<name>/deck.pdf --png build/<name>/frames
```
Produces a PDF and (optionally) one PNG per slide. Always **review the frames
visually** before declaring done (see QA).

### 5. Narrate + render video *(Phase 3+)*
Write per-slide `narration` (see `references/narration-rules.md`), synthesize
audio + word timings (TTS), then capture the deck with synced highlights and mux
with ffmpeg. Full design in `references/video-pipeline.md`.

## QA (do this before finishing)
1. Run `export_pdf.mjs ... --png frames/` and **open several frames** (cover, a
   cards slide, any diagram, the closing). Confirm: no clipped text, brand colors
   applied, fonts loaded, diagrams rendered.
2. Check `deck.words.json`: `words` count should equal the number of `data-w`
   spans in `deck.html` (they must stay in sync for karaoke).
3. If a diagram is blank, it's usually a Mermaid timing issue — re-export (capture
   waits for the SVG to size). Mermaid needs network (CDN); image visuals are
   fully offline.

## Dependencies
Install inside the skill folder:
```bash
npm install                      # reveal.js, node-vibrant, playwright
npx playwright install chromium  # for PDF/PNG export (and later video)
```
- **Node** ≥ 20 (developed on 25). **ffmpeg** (Phase 3+ video).
- TTS (Phase 3): `pip install edge-tts faster-whisper` (free path), or set
  `ELEVENLABS_API_KEY` for premium. Optional local: Kokoro ONNX.

## Roadmap
- ✅ **Phase 1** — style extraction + brand-styled deck (HTML/PDF/PNG).
- ⬜ **Phase 2** — narration scripts on each slide (+ speaker notes export).
- ⬜ **Phase 3** — TTS voiceover + simple caption-bar karaoke MP4.
- ⬜ **Phase 4** — in-slide word highlighting (the differentiator).
- ⬜ **Phase 5** — motion polish, multi-voice, `.pptx` export.

See the repository `plan/` directory for the full research-backed plan.

## Files
```
SKILL.md                 # this router
references/              # deep-dive guidance (read when relevant)
scripts/                 # extract_style, render_deck, export_pdf (+ lib/)
assets/                  # deck_template.html, base.css, highlight.css, default_theme.json
schemas/                 # project_brief + slides JSON contracts
examples/                # demo-project (slides.json) + sample-brand (style extraction)
evals/                   # trigger/output checks
```
