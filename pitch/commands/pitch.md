---
description: Full explainer — live UI demo + brand-styled deck + AI-narrated video.
argument-hint: "[project path] (defaults to the current directory)"
---
Use the **pitch** skill to produce the FULL explainer for the target project
(`$ARGUMENTS` if given, else the current working directory).

Run all five layers:
1. **Understand** the project (README, manifest, key source) → a project brief.
2. **Extract style** — `node scripts/extract_style.mjs <project> --out build/<name>`.
3. **Capture a live demo** if the project has a UI —
   `node scripts/capture_demo.mjs <project> --out build/<name> --record true`
   (if it's auth-gated, ask the user for a deployed `--url`).
4. **Deck** — write `slides.json` per `references/deck-blueprint.md`, using the
   captured UI in `showcase` slides; render with `render_deck.mjs` + `export_pdf.mjs`.
5. **Narrate + video** — write narration (`references/narration-rules.md`),
   `python3 scripts/tts.py …`, then `node scripts/render_video.mjs …` (clean
   defaults). Optionally splice the demo recording with `splice_demo.mjs`.

Before rendering the video, ask only the essentials: **TTS voice** and whether they
want **subtitles** (default off) / **on-slide highlighting** (default off).

Deliver: `deck.html` + `deck.pdf`, the narration, and `final.mp4`.
