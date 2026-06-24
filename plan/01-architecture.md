# Architecture & Pipeline

End-to-end design for the skill. The guiding principle from research: **HTML-first + deterministic render**. (Sources: `research/01`, `research/02`, `research/03`.)

## High-level pipeline

```
                         ┌──────────────────────────────────────────┐
   PROJECT INPUT  ─────► │ 1. UNDERSTAND   (agent reads repo/brief)  │
   (git repo /           │    → project_brief.json                   │
    folder / brief)      └──────────────────────────────────────────┘
                                          │
                         ┌──────────────────────────────────────────┐
                         │ 2. EXTRACT STYLE                          │
                         │    design tokens → logo palette → fonts   │
                         │    → theme.json  +  theme.css (:root vars) │
                         └──────────────────────────────────────────┘
                                          │
                         ┌──────────────────────────────────────────┐
                         │ 3. GENERATE DECK                          │
                         │    LLM → slides.json (spec, per blueprint)│
                         │    render.js → deck.html (reveal.js+theme)│
                         │    each word wrapped <span data-w="i">    │
                         │    → deck.pdf (DeckTape)  [standalone out] │
                         └──────────────────────────────────────────┘
                                          │
                         ┌──────────────────────────────────────────┐
                         │ 4. GENERATE VOICEOVER                     │
                         │    LLM → narration[ ] (per slide script)  │
                         │    TTS → slideN.mp3                        │
                         │    → slideN.words.json [{word,start,end}]  │
                         │      (edge-tts SRT / EL timestamps /       │
                         │       faster-whisper alignment)            │
                         └──────────────────────────────────────────┘
                                          │
                         ┌──────────────────────────────────────────┐
                         │ 5. RENDER VIDEO                           │
                         │    merge words.json → deck.html timeline   │
                         │    Playwright: play audio + drive          │
                         │      highlight via timeupdate, recordVideo │
                         │    ffmpeg: mux video + concatenated audio  │
                         │    → final.mp4                             │
                         └──────────────────────────────────────────┘
```

## Stage-by-stage detail

### Stage 1 — Understand the project
- **Input modes:** (a) a local folder / git repo, (b) a written brief/markdown, (c) a URL. (v1: folder/repo + brief.)
- The host agent reads `README`, `package.json`/manifest, key source, and any `docs/` to produce a **`project_brief.json`**: `{name, tagline, problem, users, solution, how_it_works, key_features[], results?, whats_next?, cta?}`. This maps 1:1 to the deck blueprint (see `03-deck-and-narration-blueprint.md`).
- This stage is the agent's strength (LLM summarization) — minimal code, mostly a structured prompt + file reads.

### Stage 2 — Extract visual style
Order of reliability (from `research/05` §2.6):
1. **Coded design tokens** (exact): W3C DTCG `tokens.json` → Tailwind `tailwind.config.js` (`resolveConfig().theme.colors`) → CSS/SCSS `:root { --color-* }` → Style Dictionary output.
2. **Logo/brand asset**: find `public/logo.*`, `favicon.*`, README banner.
3. **Palette from logo image**: **node-vibrant** (Node) or **colorthief**/Pillow+k-means (Python) → primary/secondary/accent/bg/dark.
4. **Fonts**: `@font-face`, Google Fonts links, `@fontsource/*` deps, bundled font files.
5. **Fallback**: a curated default theme (clean, neutral) if no assets found.

**Output:** `theme.json` (semantic tokens) → compiled to `theme.css` reveal.js `:root` custom properties:
```css
:root{ --r-background:#…; --r-main-color:#…; --r-heading-color:#…;
       --r-main-font:'Inter',sans-serif; --r-heading-font:'Space Grotesk',sans-serif;
       --brand-accent:#…; --brand-highlight:#…; }
```

### Stage 3 — Generate the deck
- LLM emits **`slides.json`** — an array of typed slides (`cover|problem|users|insight|solution|how|features|results|next|cta`) each with `title`, `body`, `visual` (image/diagram/none), `layout`, and **`narration`** text.
- **`render.js`** templates `slides.json` + `theme.css` → **`deck.html`** (self-contained reveal.js). During render, **every narration-relevant word on a slide is wrapped** in `<span class="w" data-w="{globalIndex}">word</span>` so it can be highlighted later. (Per `research/03` §2.4.)
- Diagrams: prefer simple **Mermaid**/SVG for "how it works"; screenshots if provided.
- **Standalone exports:** `deck.pdf` via DeckTape/Chromium; optional `deck.pptx` via Marp/Slidev image-export path (`research/01`).

### Stage 4 — Generate voiceover + timestamps
- LLM writes per-slide **narration** following the script rules (`research/04` §5: complement don't repeat, ~130–150 wpm, signposting).
- **TTS providers (pluggable):**
  - `edge-tts` (default): `edge-tts --text … --write-media s.mp3 --write-subtitles s.srt` → SRT already has word timing. **No alignment needed.**
  - `kokoro` (local): synthesize `s.wav`, then `faster-whisper word_timestamps=True` → words.json.
  - `elevenlabs` (premium): `POST /v1/text-to-speech/{voice}/with-timestamps` → char times → group to words.
  - `say` (zero-dep macOS): `say -o s.aiff`, then faster-whisper for timing.
- **Output per slide:** `sN.mp3` + `sN.words.json = [{word, start, end}]`.

### Stage 5 — Render the narrated, highlighted video
**Primary path (true in-slide highlight, the differentiator):**
1. Inject all `words.json` into `deck.html` as a JS timeline; map narration words → `<span data-w>` by order/text match.
2. Embed `<audio>` per slide; on `timeupdate`, toggle `.is-spoken` class on the active word's span (CSS transition = the highlight/motion).
3. **Playwright** opens the deck headless, plays audio, advances slides on audio-end, and **`recordVideo`** captures the canvas deterministically.
4. **ffmpeg** muxes the recorded video with the concatenated narration audio → `final.mp4`.

**MVP fallback path (caption-bar karaoke, simplest):**
1. `slidev/decktape export --png` → one still per slide.
2. Convert `words.json` → **ASS `\kf` karaoke** subtitle.
3. `ffmpeg -loop 1 -i slide.png -i s.mp3 -vf "ass=s.ass" …` per slide → concat. (From `research/02` §Architecture (i) + `research/03` §2.1.)

## Why deterministic over live screen-recording
| | Frame/Playwright render | Live screen recording |
|---|---|---|
| A/V sync | ✅ exact | ⚠️ drifts |
| Reproducible | ✅ | ❌ |
| Headless / CI | ✅ | ❌ needs display |
| System audio capture | n/a (files) | ❌ needs BlackHole/Soundflower |
| Real CSS animations | ✅ (Playwright records live DOM) | ✅ |

Conclusion (from `research/02`): **Playwright `recordVideo` gives us live animations *and* reproducibility** — the best of both. Live OS screen-recording is rejected for v1.

## Component / data-flow contract
```
project/  ──►  project_brief.json
          ──►  theme.json + theme.css
slides.json  ──►  deck.html (+deck.pdf)
narration[]  ──►  sN.mp3 + sN.words.json
deck.html + words  ──►  recording.webm  ──►(ffmpeg + audio)──►  final.mp4
```

## External dependencies (declared up-front, per skill convention)
- **Node:** reveal.js, `playwright`, `node-vibrant`, (optional `@slidev/cli`, `pptxgenjs`).
- **Python:** `edge-tts`, `faster-whisper` (timestamps), `colorthief`/`Pillow` (fallback palette), optional `kokoro-onnx`.
- **System:** `ffmpeg` (mux + ASS/libass), `pandoc` (optional md→reveal bridge), Chromium (bundled by Playwright/DeckTape).
- **Optional cloud:** ElevenLabs / Azure Speech / OpenAI TTS (API keys).
