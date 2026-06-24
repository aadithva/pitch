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
- `narration/audio/` — per-slide narration audio + word timings (`tts.py`).
- `final.mp4` — the narrated video with karaoke word-highlighting captions.

> **Status:** Phases 1–3 implemented — style extraction, brand-styled deck
> (HTML/PDF), AI voiceover, and a narrated MP4 with synced word-highlighting
> captions. Phase 4 (highlighting on the slide text itself) is next; see "Roadmap".

## Quick reference

| Goal | Do this | Details |
|------|---------|---------|
| Understand the project | Read its README/manifest/source → fill `schemas/project_brief.schema.json` | `references/authoring-decks.md` |
| Adopt the project's look | `node scripts/extract_style.mjs <projectDir> --out <dir>` | `references/theming.md` |
| Plan the slides | Write `slides.json` per the blueprint + `schemas/slides.schema.json` | `references/deck-blueprint.md` |
| Render the deck | `node scripts/render_deck.mjs <slides.json> <theme.json> --out deck.html` | this file |
| Export PDF / frames | `node scripts/export_pdf.mjs deck.html --out deck.pdf --png frames/` | this file |
| Validate deck output | `node scripts/validate_deck.mjs deck.html` | this file |
| Write narration | Add `narration` to each slide (rules) | `references/narration-rules.md` |
| Synthesize voiceover | `python3 scripts/tts.py <slides.json> --out <dir>` | `references/video-pipeline.md` |
| Render the video | `node scripts/render_video.mjs <deck.html> <dir> --out final.mp4` | `references/video-pipeline.md` |

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
`@fontsource`). It also covers common modern source files like `.tsx` and `.jsx`
so frontends built with React/Vite/Next.js are picked up cleanly. Writes
`theme.json` + `theme.css`. Keeps a professional **dark** base and adopts the
brand's primary/secondary/accent + fonts (and a dark brand background if
present). Use `--mode light` for a light deck. See `references/theming.md`.

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

### 5. Narrate + render the video
Each slide's `narration` (see `references/narration-rules.md`) drives the
voiceover. Synthesize audio + word timings, then render a narrated MP4 with
karaoke captions (the spoken word highlights in sync):
```bash
# a) TTS: narration -> per-slide mp3 + word timings (+ audio/index.json)
python3 scripts/tts.py path/to/slides.json --out build/<name> [--voice en-US-AriaNeural]

# b) Video: deck + audio -> final.mp4 (browser-rendered captions, captured
#    deterministically frame-by-frame, muxed with ffmpeg — no libass needed)
node scripts/render_video.mjs build/<name>/deck.html build/<name> \
  --out build/<name>/final.mp4 [--fps 12] [--pad 0.4]
```
The captions render in the browser using the deck's theme (`--highlight` color),
so the video is on-brand and reproducible. Full design + options:
`references/video-pipeline.md`.

## QA (do this before finishing)
1. Run `export_pdf.mjs ... --png frames/` and **open several frames** (cover, a
   cards slide, any diagram, the closing). Confirm: no clipped text, brand colors
   applied, fonts loaded, diagrams rendered.
2. Run `node scripts/validate_deck.mjs deck.html` to confirm the deck has the
   expected slide count, no unresolved placeholders, and a `deck.words.json`
   manifest that matches the `data-w` span count.
3. If a diagram is blank, it's usually a Mermaid timing issue — re-export (capture
   waits for the SVG to size). Mermaid needs network (CDN); image visuals are
   fully offline.

## Dependencies
Install inside the skill folder:
```bash
npm install                      # reveal.js, node-vibrant, playwright
npx playwright install chromium  # for PDF/PNG export and video capture

# TTS (voiceover) — use a venv (PEP 668-safe):
python3 -m venv .venv
./.venv/bin/pip install edge-tts                 # free, emits word timings
# then run: ./.venv/bin/python scripts/tts.py ...
```
- **Node** ≥ 20 (developed on 25). **ffmpeg** (any build — **libass not required**;
  captions render in-browser, not via the `ass` filter).
- **TTS:** `edge-tts` (default, free, online). Optional: ElevenLabs
  (`ELEVENLABS_API_KEY`) or local Kokoro + `faster-whisper`.

## Roadmap
- ✅ **Phase 1** — style extraction + brand-styled deck (HTML/PDF/PNG).
- ✅ **Phase 2** — per-slide narration scripts (exported as reveal.js speaker notes).
- ✅ **Phase 3** — AI voiceover (`edge-tts`) + narrated MP4 with karaoke captions.
- ⬜ **Phase 4** — highlight the words on the slide text itself (not just captions).
- ⬜ **Phase 5** — motion polish, multi-voice/provider, `.pptx` export.

See the repository `plan/` directory for the full research-backed plan.

## Files
```
SKILL.md                 # this router
references/              # deep-dive guidance (read when relevant)
scripts/                 # extract_style, render_deck, export_pdf, tts, render_video, validate_deck (+ lib/)
assets/                  # deck_template.html, base.css, highlight.css, default_theme.json
schemas/                 # project_brief + slides JSON contracts
examples/                # demo-project (slides.json) + sample-brand (style extraction)
evals/                   # trigger/output checks
```
