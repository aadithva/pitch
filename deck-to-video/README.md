# deck-to-video (skill)

Turn a project into a **brand-styled, self-explanatory deck** — and (progressively)
a **narrated, word-highlighted video**. This folder is the runnable Agent Skill;
see `SKILL.md` for the agent-facing workflow.

## Install
```bash
npm install
npx playwright install chromium   # for PDF/PNG export and video capture
python3 -m venv .venv && ./.venv/bin/pip install -q edge-tts   # voiceover (TTS)
```

## Quickstart
```bash
# 1) Extract the project's visual style → theme.json + theme.css
node scripts/extract_style.mjs examples/sample-brand --out build/sample-brand

# 2) Render a deck from a slides spec + theme → self-contained deck.html
node scripts/render_deck.mjs examples/demo-project/slides.json build/sample-brand/theme.json \
  --out build/sample-brand/deck.html

# 3) Export a PDF and per-slide PNG frames
node scripts/export_pdf.mjs build/sample-brand/deck.html \
  --out build/sample-brand/deck.pdf --png build/sample-brand/frames

# 4) Validate the deck + word manifest before sharing
node scripts/validate_deck.mjs build/sample-brand/deck.html

# 5) Synthesize the voiceover (per-slide audio + word timings)
./.venv/bin/python scripts/tts.py examples/demo-project/slides.json --out build/sample-brand

# 6) Render the narrated video with karaoke captions
node scripts/render_video.mjs build/sample-brand/deck.html build/sample-brand \
  --out build/sample-brand/final.mp4 --fps 12
```
Open `build/sample-brand/deck.html` (deck) or `final.mp4` (narrated video), or
review the PNG frames.

For a one-command smoke test, run `npm run demo` (renders + validates the bundled
demo deck), `npm run demo:pdf` for the PDF path, or `npm run demo:tts &&
npm run demo:video` for the narrated video.

## What's here
| Path | Purpose |
|------|---------|
| `SKILL.md` | Agent-facing workflow + quick reference |
| `scripts/extract_style.mjs` | Project → `theme.json`/`theme.css` (tokens, logo palette, fonts) |
| `scripts/render_deck.mjs` | `slides.json` + theme → self-contained `deck.html` (+ word manifest) |
| `scripts/export_pdf.mjs` | `deck.html` → `deck.pdf` (+ optional PNG frames) |
| `scripts/tts.py` | narration → per-slide audio + word timings (edge-tts) |
| `scripts/render_video.mjs` | deck + audio → narrated `final.mp4` with karaoke captions |
| `scripts/validate_deck.mjs` | Checks slide count, placeholder leakage, and word-manifest parity |
| `scripts/lib/` | `theme.mjs`, `deck.mjs` (rendering), `capture.mjs` (headless capture) |
| `assets/` | reveal.js template, `base.css`, `highlight.css`, `default_theme.json` |
| `schemas/` | `slides.schema.json`, `project_brief.schema.json` |
| `references/` | blueprint, narration rules, theming, video pipeline |
| `examples/` | `demo-project/` (slides), `sample-brand/` (style extraction) |
| `evals/` | trigger/output checks |

## Status
Phases 1–3 are implemented and verified: style extraction, brand-styled deck
(HTML/PDF/PNG), AI voiceover (edge-tts), and a narrated MP4 with karaoke
word-highlighting captions. Phase 4 (highlighting the slide text itself) and
Phase 5 (motion, multi-provider, `.pptx`) are specified in `references/` and the
repository `plan/`.

## License
MIT.
