---
description: Deck only — a brand-styled slide deck (HTML + PDF). No audio or video.
argument-hint: "[project path] (defaults to the current directory)"
---
Use the **pitch** skill in **DECK-ONLY** mode for the target project
(`$ARGUMENTS` if given, else the current working directory).

1. **Extract style** — `node scripts/extract_style.mjs <project> --out build/<name>`.
2. *(optional)* capture UI screenshots for `showcase` slides —
   `node scripts/capture_demo.mjs <project> --out build/<name> --record false`.
3. Write `slides.json` following `references/deck-blueprint.md` +
   `schemas/slides.schema.json`, then render:
   `node scripts/render_deck.mjs <slides.json> build/<name>/theme.json --out build/<name>/deck.html`
   and `node scripts/export_pdf.mjs build/<name>/deck.html --out build/<name>/deck.pdf`.
4. Validate with `node scripts/validate_deck.mjs build/<name>/deck.html`.

Do **not** generate narration audio or video. Deliver: `deck.html` + `deck.pdf`.
