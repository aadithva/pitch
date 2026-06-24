# Video Pipeline (Phase 3–4 design)

How the narrated, word-highlighted video will be built on top of the Phase 1 deck.
This is the implementation spec; scripts land in Phases 3–4. (Sourcing:
`research/02`, `research/03`; `plan/01-architecture.md`.)

## Overview
```
slides.json (+narration) ──► tts.py ──► sN.mp3 + sN.words.json
deck.html (data-w spans) ──► merge timings ──► record_video.mjs ──► recording.webm
recording.webm + audio   ──► assemble.py (ffmpeg) ──► final.mp4
```

## Stage 3 — TTS + word timestamps (`scripts/tts.py`)
Pluggable provider, same output contract `{ mp3, words:[{word,start,end}] }`:
- **edge-tts** (default, free): `edge-tts --text … --write-media s.mp3
  --write-subtitles s.srt` — SRT already has word timing. No alignment needed.
- **Kokoro ONNX** (local, Apache): synthesize, then `faster-whisper
  word_timestamps=True` for timings.
- **ElevenLabs** (premium): `POST /v1/text-to-speech/{voice}/with-timestamps` →
  character times → group into words.
- **macOS `say`** (zero-dep): `say -o s.aiff` + faster-whisper for timing.

Priority for timestamps: TTS-native (edge-tts/ElevenLabs) → faster-whisper → WhisperX.

## Stage 4 — In-slide karaoke (the differentiator)
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
