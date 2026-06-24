# Video Pipeline

How the narrated, word-highlighted video is built on top of the Phase 1 deck.
**Phases 2–3 are implemented**; Phase 4 (highlighting the slide text itself) is
designed below. (Sourcing: `research/02`, `research/03`; `plan/01-architecture.md`.)

## Implemented flow (Phase 3)
```
slides.json (+narration) ──► tts.py        ──► audio/sNNN.mp3 + sNNN.words.json + index.json
deck.html + audio/index  ──► render_video.mjs ──► frames (Playwright) + voiceover (ffmpeg) ──► final.mp4
```
The captions are rendered **in the browser** (the deck's own theme, `--highlight`
color) and captured deterministically frame-by-frame, then muxed with the
narration via ffmpeg. **No libass / `ass` filter is required** — any ffmpeg works.

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

## Stage 4 — In-slide karaoke (next; the differentiator)
1. **Match** narration words → on-slide `<span data-w>` (order + fuzzy text match
   using `deck.words.json`). Emit a per-slide timeline.
2. Inject the timeline into `deck.html` as `window.__NARRATION__` (the template
   already has the inert hook in `assets/deck_template.html`).
3. The deck's `<audio>` `timeupdate` toggles `.is-spoken` on the active span;
   `assets/highlight.css` defines the highlight + motion. Past words get
   `.was-spoken`; `.reveal.narration-active` dims upcoming words.
4. **Record** with `record_video.mjs` (Playwright): for reproducibility, drive the
   highlight from a computed clock and advance slides on each slide's audio
   duration, capturing via `recordVideo` (don't rely on real-time audio playout in
   headless — mux audio after).

## MVP fallback — caption-bar karaoke (Phase 3)
Simpler path that ships value first:
1. `export_pdf.mjs --png` → one still per slide (already implemented).
2. `make_ass.py`: `words.json` → ASS `\kf` karaoke subtitle.
3. ffmpeg per slide: `-loop 1 -i slide.png -i sN.mp3 -vf "ass=sN.ass"` → segment;
   then concat → `final.mp4`.

## Stage 5 — Assemble (`scripts/assemble.py`)
- Primary: mux `recording.webm` + concatenated narration audio.
- Fallback: concat per-slide segments.
- `ffmpeg -f concat -safe 0 -i list.txt -c copy final.mp4`.

## Why not OS screen-recording
Deterministic Playwright capture gives real CSS animations **and** reproducibility,
runs headless, and needs no virtual audio device (BlackHole/Soundflower). See the
architecture comparison in `plan/01-architecture.md`.

## Reuse from Phase 1
- `scripts/lib/capture.mjs` already opens the deck headlessly, disables transitions
  for clean stills, and waits for Mermaid — the video recorder extends this.
- `deck.words.json` is the bridge between narration and on-slide spans.
