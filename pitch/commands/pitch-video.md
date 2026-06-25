---
description: Deck + AI voiceover -> a narrated MP4 (no live UI capture).
argument-hint: "[project path] (defaults to the current directory)"
---
Use the **pitch** skill in **DECK + VIDEO** mode for the target project
(`$ARGUMENTS` if given, else the current working directory).

1. **Extract style** + **generate the deck** (`extract_style.mjs`, write
   `slides.json`, `render_deck.mjs`).
2. **Narrate** — write per-slide narration (`references/narration-rules.md`) and
   `python3 scripts/tts.py build/<name>/slides.json --out build/<name>`.
3. **Render the video** — `node scripts/render_video.mjs build/<name>/deck.html
   build/<name> --out build/<name>/final.mp4 --fps 12` (clean: no captions/highlight
   unless the user opts in).

Skip the live UI capture step. Ask the user about **TTS voice** and **captions**
(default off) first. Deliver: `deck.html` + `deck.pdf` + `final.mp4`.
