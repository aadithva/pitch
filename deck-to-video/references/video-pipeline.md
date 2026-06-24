# Video Pipeline

How the narrated, word-highlighted video is built on top of the Phase 1 deck.
**Phases 2–3 are implemented**; Phase 4 (highlighting the slide text itself) is
designed below. (Sourcing: `research/02`, `research/03`; `plan/01-architecture.md`.)

## Implemented flow (Phase 3)
```
slides.json (+narration) ──► tts.py        ──► audio/sNNN.mp3 + sNNN.words.json + index.json
deck.html + audio/index  ──► render_video.mjs ──► frames (Playwright) + voiceover (ffmpeg) ──► final.mp4
```
The video is rendered deterministically (Playwright frame capture + ffmpeg mux);
**no libass / `ass` filter is required** — any ffmpeg works. By **default the video
is clean**: a narrated deck with **no caption bar and no on-slide highlight**.
Subtitles and word-highlighting are **opt-in** — ask the user, then pass
`--captions true` and/or `--inslide true`. When enabled, both render in the
browser using the deck's theme (the active word recolors to `--accent`, not a
block), captured frame-by-frame.

### Commands
```bash
python3 scripts/tts.py slides.json --out build/<name> [--voice en-US-AriaNeural]
node scripts/render_video.mjs build/<name>/deck.html build/<name> \
  --out build/<name>/final.mp4 [--fps 12] [--pad 0.4]
```

## Stage 3 — TTS + word timestamps (`scripts/tts.py`)
Pluggable provider; output contract per slide: `sNNN.mp3` + `sNNN.words.json`
(`[{text,start,end}]` seconds) + `audio/index.json` (durations).
- **edge-tts** (default, free, implemented): uses the streaming API with
  `boundary="WordBoundary"` to get exact per-word offsets natively — no separate
  alignment step. Duration is read back with `ffprobe`.
- **Kokoro ONNX** (local, Apache): synthesize, then `faster-whisper
  word_timestamps=True` for timings.
- **ElevenLabs** (premium): `POST /v1/text-to-speech/{voice}/with-timestamps` →
  character times → group into words.
- **macOS `say`** (zero-dep): `say -o s.aiff` + faster-whisper for timing.

Priority for timestamps: TTS-native (edge-tts/ElevenLabs) → faster-whisper → WhisperX.

## Stage 3 render — karaoke captions (`scripts/render_video.mjs`, implemented)
1. Build a global timeline from `audio/index.json` + each `words.json`, folding a
   `--pad` gap between slides so the caption clock matches the assembled audio.
2. Inject a caption overlay + `__dvSeek(t)` driver into a temp `deck.__video.html`.
3. Playwright opens it, disables transitions, and for each frame `t = f/fps` calls
   `__dvSeek(t)` (navigates to the active slide, highlights the active word) and
   screenshots. Waits for Mermaid SVGs when a diagram slide appears.
4. ffmpeg concatenates per-slide audio (mp3 + silence pad / `anullsrc` for silent
   slides) into `voiceover.wav`, then muxes `frames + voiceover → final.mp4`.
   Deterministic and reproducible; transitions are disabled so every frame shows a
   clean highlight state.

## Stage 4 — In-slide highlighting (implemented)
The actual slide words light up as they're spoken, in addition to the caption.
1. **Match** narration words → on-slide `<span data-w>` words via
   `scripts/lib/align.mjs` (`matchInslide`): normalize (lowercase + strip
   punctuation), skip stopwords and words < 3 chars, and queue-match per slide so
   each on-slide word highlights the first time its text is spoken. Returns
   global-time `{ dataW, start, end }` events from `deck.words.json` + the slide's
   `words.json`.
2. `render_video.mjs` folds these events into the timeline and the injected driver
   toggles `.is-spoken` (from `assets/highlight.css`) on the matching span at each
   frame — only the currently-spoken word is marked (no trailing state), for a
   clean karaoke look.
3. Captions and in-slide highlights are independent layers: `--captions
   true|false` and `--inslide true|false`. Both use the deck theme's `--highlight`.
4. Transitions on `.w` are forced off during capture so every frame shows a crisp
   highlight state (deterministic).

> Not used: an earlier plan burned ASS `\kf` karaoke captions with ffmpeg, but
> this environment's ffmpeg lacks libass. Rendering the highlight in the browser
> (above) avoids that dependency entirely and reuses the deck's own styling.
Deterministic Playwright capture gives real CSS animations **and** reproducibility,
runs headless, and needs no virtual audio device (BlackHole/Soundflower). See the
architecture comparison in `plan/01-architecture.md`.

## Reuse from Phase 1
- `scripts/lib/capture.mjs` already opens the deck headlessly, disables transitions
  for clean stills, and waits for Mermaid — the video recorder extends this.
- `deck.words.json` is the bridge between narration and on-slide spans.
