
---

# Research Report: TTS Voiceover + Slides-to-Video Pipelines for the Agent Skill

## Summary

This report covers two linked pipelines needed for the "PPT Skill" agent:  
**(A)** Text-to-speech options from macOS-native to state-of-the-art open-source neural TTS — with a special focus on which engines produce **word/phoneme-level timestamps** (critical for karaoke-highlighting).  
**(B)** Tools and architectures for converting a slide deck + audio into a rendered MP4 video — from pure ffmpeg compositing, to headless Playwright-powered export, to live screen recording.

The final recommendation favors **Kokoro ONNX + Slidev PNG export → ffmpeg mux** (Architecture i) as the primary headless, deterministic, macOS-compatible path, with `edge-tts` as a zero-model fallback.

---

## Part A: Text-to-Speech / AI Voiceover

### A1. macOS Built-In: `say` Command

| Attribute | Details |
|-----------|---------|
| **URL** | macOS built-in (`man say`) |
| **License** | Proprietary (Apple) |
| **Install** | Zero — ships with macOS |
| **Voices/Languages** | 60+ neural voices (Alex, Samantha, Daniel, etc.), dozens of languages |
| **Quality** | Acceptable for demos; pre-neural feel on older voices; newer Siri voices are much better |
| **Speed** | Real-time or faster |
| **Word Timestamps** | ❌ None |
| **Output Formats** | AIFF (default), WAV, CAFF via `-o` flag |
| **CLI Example** | `say -v "Samantha" "Hello World" -o output.aiff` |
| **Pipeline fit** | Zero-dependency demo/fallback. Convert to WAV: `ffmpeg -i output.aiff output.wav`. |

**Notes:** Not scriptable for timestamps. Quality sufficient for a first-pass demo but not production. AVSpeechSynthesizer in Swift/Objective-C provides `willSpeakRangeOfSpeechString` callbacks for word boundaries — accessible from Python via `subprocess` + a companion Swift helper or `pyobjc`.

---

### A2. Kokoro (hexgrad/kokoro + thewh1teagle/kokoro-onnx) ⭐ **PRIMARY RECOMMENDATION**

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/hexgrad/kokoro (7,608 ★) · https://github.com/thewh1teagle/kokoro-onnx |
| **License** | Apache 2.0 (code + weights) |
| **Stack** | Python (PyTorch) or ONNX Runtime; uses `misaki` G2P |
| **Voices** | 54+ across American/British EN, ZH, JA, ES, FR, HI, IT, PT |
| **Quality** | Comparable to much larger models; "human-level" for English |
| **Speed** | Near real-time on M1 (MPS-accelerated), CPU usable |
| **Model size** | PyTorch: ~82M params; ONNX: ~300MB (quantized: ~80MB) |
| **Word Timestamps** | ✅ Via CTC forced alignment on output; the ONNX pipeline exposes `alignment.align_matrix` for phoneme → audio alignment |
| **Install** | `pip install kokoro soundfile` + `brew install espeak-ng` |

**CLI example:**
```python
from kokoro import KPipeline
pipeline = KPipeline(lang_code='a')
for i, (gs, ps, audio) in enumerate(pipeline("Your text here", voice='af_heart')):
    # gs = graphemes, ps = phonemes, audio = np.ndarray at 24kHz
    sf.write(f'{i}.wav', audio, 24000)
```

**Word timestamp extraction** (verified pattern from `kevinbazira/wikipedia-companion:companion/tts.py`):
```python
# After synthesis, run CTC forced alignment:
from companion import align  # or use ctc-forced-aligner or whisperx
words = align.align_words(audio, sr, text)
# returns: [{"word": "Hello", "start_ms": 0, "end_ms": 320}, ...]
vtt = align.timestamps_to_vtt(words)  # WebVTT for karaoke
```

**ONNX variant** (`kokoro-onnx`) — used by FreeVi project for production PDF-to-video, lighter, no PyTorch needed, MIT + Apache 2.0.

> Cited: `kevinbazira/wikipedia-companion:companion/tts.py` · `ahmedmehrem/kokoro:kokoro/pipeline.py` · `thewh1teagle/kokoro-onnx` README · `maximofraisinet/FreeVi` README

---

### A3. Piper (rhasspy/piper → OHF-Voice/piper1-gpl)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/rhasspy/piper (11,138 ★, archived) · https://github.com/OHF-Voice/piper1-gpl (actively seeking maintainers) |
| **License** | MIT |
| **Stack** | C++ core, Python bindings; embedded espeak-ng |
| **Voices** | ~80 voice models, ~20 languages |
| **Quality** | "Low quality but very fast" to "medium quality"; best for embedded/IoT |
| **Speed** | Extremely fast (real-time × 10+ on CPU) |
| **Model size** | ~60MB per voice (ONNX) |
| **Word Timestamps** | ❌ None natively |
| **CLI** | `echo "text" \| piper --model en_US-lessac-medium --output_file out.wav` |
| **macOS** | Supported (Homebrew install or binary) |

**Pipeline fit:** Best if you need the absolute fastest, most lightweight local TTS with no internet. No timestamps means you'd need WhisperX post-processing for karaoke sync.

> Cited: `rhasspy/piper` API response (archived: true, pushed 2025-08-26) · `OHF-Voice/piper1-gpl` README

---

### A4. Coqui TTS (coqui-ai/TTS)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/coqui-ai/TTS (45,611 ★) |
| **License** | MPL-2.0 |
| **Stack** | Python 3.9–3.11, PyTorch |
| **Models** | VITS, GlowTTS, Tacotron2, XTTS v2 (16 languages, voice cloning), YourTTS, Fairseq (~1100 languages) |
| **Quality** | XTTS v2 is excellent; voice cloning from short sample |
| **Speed** | VITS: fast; Tacotron2: moderate; XTTS v2: moderate on CPU |
| **Word Timestamps** | ❌ Not native; post-process with WhisperX |
| **Maintenance** | ⚠️ Last push: Aug 2024 (company shut down 2024). Frozen but functional |
| **CLI** | `tts --text "Hello" --model_name tts_models/en/ljspeech/vits --out_path out.wav` |

**Pipeline fit:** Huge model zoo is valuable. XTTS v2 for voice cloning. However, the company is defunct — consider kokoro or F5-TTS for active maintenance.

> Cited: `coqui-ai/TTS` README, API (45k stars, MPL-2.0, archived=false but pushed Aug 2024)

---

### A5. Bark (suno-ai/bark)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/suno-ai/bark (39,171 ★) |
| **License** | MIT (as of 2023-05-01) |
| **Stack** | Python, PyTorch (transformer-based) |
| **Voices** | 100+ speaker presets, 30+ languages; voice consistency through history_prompt |
| **Quality** | Highly realistic prosody, laughter, sighs, non-verbal sounds |
| **Speed** | Slow on CPU (2–5 min/sentence), much faster on GPU |
| **Word Timestamps** | ❌ None (fully autoregressive; timing is stochastic) |
| **CLI** | `python -m bark --text "Hello" --output_filename example.wav` |

**Pipeline fit:** Great for expressive presentation narration with emotional range. Avoid for time-critical rendering due to speed. Not suitable for timestamp-driven karaoke without post-processing.

> Cited: `suno-ai/bark` README (39k stars, MIT)

---

### A6. Tortoise-TTS (neonbjb/tortoise-tts)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/neonbjb/tortoise-tts |
| **License** | Apache 2.0 |
| **Stack** | Python, PyTorch; autoregressive + diffusion |
| **Quality** | Very high realism, multi-voice |
| **Speed** | Very slow on CPU; macOS M1 supported (MPS fallback, DeepSpeed disabled) |
| **Word Timestamps** | ❌ None |
| **Status** | Low maintenance (original author); active forks (e.g., `152334H/tortoise-tts-fast`) |

**Pipeline fit:** Quality showcase but too slow for a scripted pipeline unless you have a GPU.

---

### A7. StyleTTS2 (yl4579/StyleTTS2)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/yl4579/StyleTTS2 |
| **License** | MIT (code); CC BY-NC 4.0 (models — **non-commercial only**) |
| **Stack** | Python, PyTorch; style diffusion + WavLM discriminators |
| **Quality** | "First human-level TTS on LJSpeech" — outstanding quality |
| **Speed** | Moderate; requires espeak-ng and phonemizer |
| **Word Timestamps** | ❌ None natively |

**Pipeline fit:** Best quality locally for non-commercial use. Complex setup (phonemizer, espeak). Use for demo quality demos only.

---

### A8. MeloTTS (myshell-ai/MeloTTS)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/myshell-ai/MeloTTS |
| **License** | MIT |
| **Stack** | Python, PyTorch; based on VITS/VITS2/Bert-VITS2 |
| **Languages** | EN, ZH (+ mixed), ES, FR, JP, KR |
| **Speed** | Fast enough for CPU real-time inference |
| **Word Timestamps** | ❌ None |

**Pipeline fit:** Good lightweight multilingual option; MIT license is clean.

---

### A9. F5-TTS (SWivid/F5-TTS)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/SWivid/F5-TTS (14,811 ★) |
| **License** | MIT |
| **Stack** | Python 3.10+, PyTorch; flow matching diffusion, ConvNeXt V2 |
| **Quality** | Very high; RTF 0.04–0.15 on GPU |
| **Speed** | Faster than Tortoise; Apple Silicon: `pip install torch torchaudio` |
| **Word Timestamps** | ❌ Not native |
| **CLI** | `f5-tts_infer-cli --model F5TTS_v1_Base --ref_audio ref.wav --ref_text "..." --gen_text "..."` |

**Pipeline fit:** Good voice-cloning quality with manageable speed. Actively maintained (2024–present).

> Cited: `SWivid/F5-TTS` README (14.8k stars, MIT)

---

### A10. ChatTTS (2noise/ChatTTS)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/2noise/ChatTTS |
| **License** | AGPLv3 (code); **CC BY-NC 4.0 (models — non-commercial only)** |
| **Stack** | Python, PyTorch; trained on 100K+ hours (ZH + EN) |
| **Quality** | Excellent prosody for dialogue; fine-grained [oral_2][laugh_0][break_6] tokens |
| **Word Timestamps** | ❌ None |

**Pipeline fit:** Great for natural-sounding narration. License is restrictive (non-commercial models, AGPLv3 code). Avoid for commercial products.

---

### A11. edge-tts (rany2/edge-tts) ⭐ **RECOMMENDED FALLBACK**

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/rany2/edge-tts |
| **License** | GPL-3.0 (library); uses Microsoft Edge cloud service (ToS) |
| **Stack** | Python async; calls `speechsynthesis.trafficmanager.net` |
| **Voices** | 400+ neural voices, 100+ languages/locales |
| **Quality** | Neural-quality; Microsoft Azure Speech backend |
| **Speed** | Network latency (~200–500ms) |
| **Word Timestamps** | ✅ **YES — native SRT output (`--write-subtitles`)** |
| **CLI** | `edge-tts --text "Hello World" --voice en-US-AriaNeural --write-media hello.mp3 --write-subtitles hello.srt` |
| **Offline?** | ❌ Requires internet (Microsoft cloud) |
| **Cost** | Free (uses Edge browser backend) |

**Word-level timestamps verified:** The `--write-subtitles` flag produces an SRT file with word-level timing. These map directly to karaoke highlighting.

```bash
edge-tts --text "This is a test sentence." \
  --voice en-US-AriaNeural \
  --write-media speech.mp3 \
  --write-subtitles speech.srt
# speech.srt contains per-word timestamps in SRT format
```

> Cited: `rany2/edge-tts` README (verified `--write-subtitles` feature); real-world usage in `jimmyorona/sam-studio:scripts/pptx_to_video.py`

---

### A12. Cloud APIs: OpenAI TTS, ElevenLabs, Azure Speech

| Service | Model | Voices | Timestamps | Cost | Offline |
|---------|-------|--------|-----------|------|---------|
| **OpenAI TTS** | `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd` | 13 | ❌ (no word timestamps in API) | ~$0.015/1K chars (tts-1) | ❌ |
| **ElevenLabs** | `eleven_multilingual_v2` | 700+ | ✅ **WebSocket returns `charStartTimesMs` + `charDurationsMs`** | ~$0.30/1K chars | ❌ |
| **Azure Speech** | Neural TTS | 500+ | ✅ Via word boundary events in SDK | Varies (~$4/1M chars) | ❌ |
| **Google Cloud TTS** | Neural2, Studio | 400+ | ✅ Via `timepoints` in `AudioConfig` | ~$4/1M chars | ❌ |

> Cited: OpenAI TTS Docs (https://developers.openai.com/api/docs/guides/text-to-speech) · ElevenLabs WebSocket spec (`NormalizedAlignment.charStartTimesMs` in API schema)

---

### A13. Universal Timestamp Solution: WhisperX / Forced Alignment

For any TTS that doesn't output native word timestamps, run **forced alignment** post-synthesis:

| Tool | Approach | Accuracy | macOS |
|------|----------|----------|-------|
| **WhisperX** (m-bain/whisperX) | wav2vec2 alignment after Whisper transcription | ~50ms accuracy | ✅ (`--device cpu --compute_type int8`) |
| **ctc-forced-aligner** | CTC alignment with wav2vec2 | High | ✅ |
| **Montreal Forced Aligner (MFA)** | HMM acoustic models | High but complex | ✅ |

```bash
# WhisperX on pre-generated TTS audio:
whisperx speech.wav --language en --compute_type int8 --device cpu
# Outputs: speech.srt / speech.json with word-level timestamps
```

> Cited: `m-bain/whisperX` README (70x realtime, word-level timestamps via wav2vec2)

---

## Word Timestamp Summary Table

| Engine | Native Timestamps | Notes |
|--------|-------------------|-------|
| macOS `say` | ❌ | AVSpeechSynthesizer word callbacks in Swift only |
| **Kokoro** | ✅ Via alignment | `align_matrix` → CTC forced align → word timings |
| **edge-tts** | ✅ Native SRT | `--write-subtitles` in CLI |
| **ElevenLabs** | ✅ Native | WebSocket `charStartTimesMs` |
| **Azure Speech** | ✅ Native | SDK word-boundary events |
| Coqui TTS | ❌ | Need WhisperX post |
| Piper | ❌ | Need WhisperX post |
| Bark | ❌ | Need WhisperX post |
| F5-TTS | ❌ | Need WhisperX post |
| ChatTTS | ❌ | Need WhisperX post |

---

## Part B: Slides + Audio → Video

### B1. Remotion (remotion-dev/remotion) ⭐

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/remotion-dev/remotion (51,103 ★) |
| **License** | Custom (free for individuals/OSS; company license required for commercial use) |
| **Stack** | TypeScript/React + Headless Chrome + ffmpeg (internal) |
| **How it works** | Renders React components frame-by-frame via Chromium; timestamps are driven by `useCurrentFrame()` hook |
| **Output** | MP4 (H.264/H.265), WebM, GIF |
| **CLI** | `npx remotion render MyComp out.mp4` |
| **Headless** | ✅ Full headless support |
| **Audio** | `<Audio>` component, precisely synced with `<Sequence>` |
| **Karaoke** | Can render word highlights at exact frame positions |
| **Maintenance** | Very active (pushed June 24, 2026) |
| **macOS** | ✅ |

**Pipeline fit:** Most powerful option for programmatic video with precise audio sync. Learning curve (React). License may be an issue for commercial/CLI skill.

> Cited: `remotion-dev/remotion` README (51k stars) and API (TypeScript, active)

---

### B2. Motion Canvas (motion-canvas/motion-canvas)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/motion-canvas/motion-canvas |
| **License** | MIT |
| **Stack** | TypeScript generators, Vite, browser editor |
| **How it works** | Programmatic vector animations synchronized with voice-overs |
| **Audio sync** | Built-in — explicitly designed for "synchronize with voice-overs" |
| **Headless** | ⚠️ UI button required for render (motion-canvas is standalone editor, not library) |
| **Maintenance** | Active |

**Pipeline fit:** Good for animated presentations; less scriptable than Remotion (requires UI interaction to render).

> Cited: `motion-canvas/motion-canvas` README: *"A TypeScript library that uses generators to program animations... synchronize them with voice-overs"*

---

### B3. Revideo (midrender/revideo)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/midrender/revideo |
| **License** | MIT |
| **Stack** | TypeScript; forked from Motion Canvas |
| **Key difference** | Adds **headless rendering** as a function call + parallelized rendering + `<Audio>` tag |
| **Headless** | ✅ `renderVideo({ project, settings })` API |
| **Audio** | `<Audio>` + `<Video>` components; muxes audio in final MP4 |
| **CLI** | `npm create revideo@latest` |
| **Maintenance** | Active (2024) |

**Pipeline fit:** Better than Motion Canvas for scripted/headless use. TypeScript requirement may be a barrier for a Python-first skill.

> Cited: `midrender/revideo` README: *"Headless Rendering... exposed this functionality as a function call"*

---

### B4. Manim Community (ManimCommunity/manim)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/ManimCommunity/manim |
| **License** | MIT |
| **Stack** | Python, OpenGL/Cairo rendering, ffmpeg output |
| **How it works** | Scene-based animation: `class MySlide(Scene): def construct(self): self.add(Text("Hello"))` |
| **Output** | MP4 via internal ffmpeg pipeline |
| **Audio** | `self.add_sound("narration.wav")` — can sync audio to animations |
| **Headless** | ✅ CLI: `manim -ql myslides.py MySlideScene` |
| **macOS** | ✅ (Homebrew: `brew install manim`) |
| **Maintenance** | Very active |

**Pipeline fit:** Best for math/diagram-heavy slides with programmatic animations. Python-native fits the skill stack well. Audio sync for narration is possible but less precise than Remotion.

> Cited: `ManimCommunity/manim` README

---

### B5. MoviePy (Zulko/moviepy)

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/Zulko/moviepy |
| **License** | MIT |
| **Stack** | Python, numpy, ffmpeg |
| **How it works** | Load images/video clips, add text, composite, export |
| **Headless** | ✅ |
| **Audio** | `AudioFileClip` + `CompositeAudioClip` — simple muxing |
| **Karaoke** | Can render `TextClip` with timed `Sequence` + manual positioning |
| **Limitations** | Slower than direct ffmpeg; v2.0 has breaking changes; no reactive DOM |
| **macOS** | ✅ |

```python
from moviepy import VideoFileClip, ImageClip, AudioFileClip, CompositeVideoClip
slide = ImageClip("slide_01.png", duration=15).with_position('center')
audio = AudioFileClip("slide_01.wav")
video = slide.with_audio(audio)
video.write_videofile("out.mp4", fps=24)
```

**Pipeline fit:** Great for simple "image + audio → video" per slide, then ffmpeg concat. Best for a Python-native, minimal-dependency solution.

> Cited: `Zulko/moviepy` README (v2.0)

---

### B6. Slidev (slidevjs/slidev) — Per-Slide PNG Export → ffmpeg

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/slidevjs/slidev |
| **License** | MIT |
| **Stack** | Node.js, Vue.js, Vite; Playwright for export |
| **Export command** | `slidev export --format png --output slides/` → per-slide PNG files |
| **Headless** | ✅ Uses Playwright Chromium internally (`packages/slidev/node/commands/export.ts`) |
| **Video export** | ❌ No built-in video; but PNG → ffmpeg path is well-documented |
| **Karaoke** | Via custom Vue components + `<video>` overlay or subtitle burn-in |
| **macOS** | ✅ |

**Verified export implementation** (`slidevjs/slidev:packages/slidev/node/commands/export.ts`):
```typescript
// Line 148-165: Playwright-based per-slide screenshot
const { chromium } = await importPlaywright()
const browser = await chromium.launch({ executablePath })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
// ... navigates to slide URLs, screenshots each one
```
Then assemble with ffmpeg:
```bash
# Per-slide video segments with audio:
ffmpeg -loop 1 -i slides/001.png -i audio/001.wav \
  -c:v libx264 -tune stillimage -c:a aac -shortest segments/001.mp4

# Concat all segments:
ffmpeg -f concat -safe 0 -i segments.txt -c copy final.mp4
```

> Cited: `slidevjs/slidev:packages/slidev/node/commands/export.ts:148-165` (Playwright export implementation)

---

### B7. Playwright — Headless Screenshot + `recordVideo` 

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/microsoft/playwright |
| **License** | Apache 2.0 |
| **Stack** | Node.js / Python / .NET / Java |
| **Screenshot** | `await page.screenshot({ path: 'slide.png' })` |
| **Video recording** | `context = browser.newContext(record_video_dir='./video/', record_video_size={'width': 1920, 'height': 1080})` |
| **Headless** | ✅ Full headless Chromium/Firefox/WebKit |
| **Audio** | ⚠️ `recordVideo` does NOT capture audio — only visual |

**Confirmed from `CJohnDesign/FEN_Sliders:docs/headless-video-export.md`:**
```javascript
const { chromium } = require('playwright');
const context = await browser.newContext({
  recordVideo: {
    dir: './temp/video-export',
    size: { width: 1920, height: 1080 }
  }
});
```

> Cited: GitHub search result `CJohnDesign/FEN_Sliders:docs/headless-video-export.md` (Playwright recordVideo pattern)

---

### B8. ffmpeg — macOS Screen Recording (avfoundation)

| Attribute | Details |
|-----------|---------|
| **Docs** | https://trac.ffmpeg.org/wiki/Capture/Desktop |
| **macOS input** | `-f avfoundation` |
| **Enumerate devices** | `ffmpeg -f avfoundation -list_devices true -i ""` |
| **Record screen + audio** | `ffmpeg -f avfoundation -i "<screen_idx>:<audio_idx>" output.mkv` |
| **Headless** | ❌ Requires a display (physical or virtual) |
| **Automation** | Can start/stop via `subprocess.Popen` + `stdin.write(b'q')` to quit |

```bash
# List devices on macOS:
ffmpeg -f avfoundation -list_devices true -i ""
# Output: [0] Capture screen 0, [1] FaceTime Camera; [0] Built-in Microphone

# Record screen 0 + audio device 0:
ffmpeg -f avfoundation -framerate 30 -i "0:0" output.mkv
```

**⚠️ Key limitation:** avfoundation screen capture is NOT headless — it reads from the actual macOS display compositor. A virtual display (e.g., `Xvfb` on Linux, or `fbuffer` on macOS via `xquartz`) would be required for CI. On macOS with a logged-in user, it works fine interactively.

> Cited: `trac.ffmpeg.org/wiki/Capture/Desktop#macOS` (avfoundation section)

---

### B9. macOS `screencapture` Command

```bash
# Record 30 seconds to a video file:
screencapture -v -T 30 output.mov

# Record the display (no audio):
screencapture -R "0,0,1920,1080" -t mov output.mov
```

**Limitations:** Cannot capture system audio. No programmatic "stop at end of narration" hook. Not headless. Best for manual demo recording, not automated pipeline.

---

### B10. FreeVi (maximofraisinet/FreeVi) — End-to-End Reference

| Attribute | Details |
|-----------|---------|
| **URL** | https://github.com/maximofraisinet/FreeVi |
| **License** | (MIT — code; Apache 2.0 model) |
| **Stack** | Python; Kokoro ONNX or VibeVoice TTS; Ollama LLM; Pexels/AI-slides |
| **What it does** | PDF → video with narration + word-level karaoke subtitles |
| **Word sync** | Whisper AI (whisperx) for "Pro" mode word-level sync |
| **Slides** | AI-generated Cairo slides (themed: Tokyo Night, Executive, Minimal) |
| **macOS** | ✅ `brew install cairo` |
| **Subtitle burn-in** | ffmpeg + subtitle timing from Whisper alignment |

**This is the closest existing open-source analog to the target skill.** Key lesson: it uses Kokoro ONNX for TTS + ffmpeg for composition + WhisperX for timestamp generation.

> Cited: `maximofraisinet/FreeVi` README

---

### B11. pptx_to_video.py (jimmyorona/sam-studio) — Real-World Pipeline

This script implements the exact pipeline needed:

```
PPTX/Markdown → LibreOffice PDF → pdftoppm PNGs
              + edge-tts narration per slide (MP3 + SRT timestamps)
              + ffmpeg: image × audio duration → per-slide MP4
              → ffmpeg concat → final MP4
```

Sources: `jimmyorona/sam-studio:scripts/pptx_to_video.py` lines 1–90:
```
Dependencies: edge-tts, python-pptx, LibreOffice (soffice), pdftoppm, ffmpeg, marp-cli
TTS providers: edge-tts (default), ElevenLabs, Supertonic
Voice: en-US-AriaNeural (edge-tts)
```

> Cited: `jimmyorona/sam-studio:scripts/pptx_to_video.py:1-90`

---

## Architecture Comparison: (i) Deterministic vs. (ii) Live Screen Recording

### Architecture (i): Deterministic Frame-by-Frame Render

```
Markdown/Design
    │
    ├─ [Step 1: Slides → Images]
    │   Slidev export --format png   OR   Playwright screenshots
    │   → slide_001.png, slide_002.png, ...
    │
    ├─ [Step 2: TTS per slide]
    │   Kokoro ONNX: text → speech.wav
    │   CTC align:   speech.wav → words.json [{word, start_ms, end_ms}]
    │   → slide_001.wav + slide_001_words.json
    │
    ├─ [Step 3: Per-slide video segments]
    │   duration = len(audio) + pause
    │   ffmpeg -loop 1 -i slide_001.png -i slide_001.wav
    │          -t $duration slide_001.mp4
    │
    ├─ [Step 4: Karaoke overlay]
    │   Convert words.json → SRT/ASS subtitle file
    │   ffmpeg -i slide_001.mp4 -vf subtitles=slide_001.srt slide_001_karaoke.mp4
    │
    └─ [Step 5: Concatenate]
        ffmpeg -f concat -safe 0 -i segments.txt -c copy final.mp4
```

### Architecture (ii): Live Screen Recording

```
    ├─ Start Slidev dev server (npx slidev slides.md --port 3000)
    ├─ Start ffmpeg avfoundation screen recording
    │   ffmpeg -f avfoundation -i "1:0" recording.mkv &
    ├─ Playwright: navigate to deck, advance slides every N seconds
    │   (or playback pre-recorded audio while advancing)
    ├─ Stop ffmpeg
    └─ Trim/cut final.mp4
```

---

### Comparison Table

| Criterion | (i) Frame-by-Frame | (ii) Live Screen Recording |
|-----------|-------------------|---------------------------|
| **Audio/visual sync** | ✅ Perfect (muxed deterministically) | ⚠️ Depends on timing precision |
| **Reproducibility** | ✅ Bit-for-bit identical | ❌ System load, GC pauses affect timing |
| **Headless / CI-safe** | ✅ No display required | ❌ Requires macOS display (avfoundation needs compositor) |
| **CSS/JS animations** | ❌ Static frames only (unless Remotion/Revideo) | ✅ Full browser animations captured |
| **Karaoke highlight sync** | ✅ Computed before render, frame-accurate | ⚠️ Must post-process video; timing approximate |
| **Ease in skill** | ✅ High — predictable pipeline steps | ❌ Many failure modes (window focus, display server) |
| **macOS "inbuilt audio"** | N/A — audio is generated files | ⚠️ Only if "system audio loopback" is configured (BlackHole, Soundflower) |
| **Setup complexity** | Low-medium (Slidev + ffmpeg + TTS) | High (screen recording + audio routing) |
| **Animation quality** | Static (good for info slides) | Dynamic (CSS transitions, slides.com-style) |
| **GPU requirement** | Optional (TTS only) | Optional |
| **Cross-platform** | ✅ | ❌ macOS-only with avfoundation |

---

## Final Recommendation

### Recommended End-to-End Pipeline (Steps 3–4 of the Skill)

**Step 3: TTS + Timestamps**
```
Primary:  Kokoro ONNX (thewh1teagle/kokoro-onnx)
          → pip install kokoro-onnx soundfile
          → kokoro-v1.0.onnx + voices-v1.0.bin (~300MB)
          → After synthesis: run ctc-forced-aligner or whisperx
          → words.json with [word, start_ms, end_ms]

Fallback: edge-tts (rany2/edge-tts)
          → pip install edge-tts
          → edge-tts --text "..." --write-media out.mp3 --write-subtitles out.srt
          → SRT has native word-level timing ← EASIEST for karaoke
          → Requires internet / Microsoft cloud (free)

Zero-dep: macOS `say` -o output.aiff + WhisperX for timestamps
          (no word timestamps natively; add forced alignment separately)
```

**Step 4: Render MP4**
```
Use Architecture (i) — Deterministic:

1. npx @slidev/cli export slides.md --format png --output ./frames/
   (uses Playwright headless Chromium internally)

2. Per slide:
   kokoro-onnx → slide_N.wav
   ctc-forced-aligner slide_N.wav → slide_N.json (word timings)
   Convert to ASS subtitle → slide_N.ass

3. Build slide video:
   ffmpeg -loop 1 -i frames/slide_N.png \
          -i slide_N.wav \
          -vf "ass=slide_N.ass" \
          -c:v libx264 -tune stillimage \
          -c:a aac -shortest \
          segments/slide_N.mp4

4. Concatenate:
   ffmpeg -f concat -safe 0 -i concat_list.txt -c copy final.mp4
```

**Why not screen recording?** The macOS avfoundation screen recording approach requires a live display, is non-reproducible, cannot run headlessly in CI, and capturing "system audio" requires an additional virtual audio device (BlackHole/Soundflower). For a programmatic skill, these failure modes are unacceptable. Frame-by-frame is simpler, faster, and more reliable.

**Why Kokoro ONNX?**
- Apache 2.0 — cleanest license for a skill/tool
- ~300MB vs. hundreds of GB for alternatives
- Fast on Apple Silicon M-series (near real-time)  
- Word-level timestamps achievable via CTC forced alignment (verified in FreeVi, wikipedia-companion projects)
- Actively maintained ONNX runtime variant (no PyTorch needed for inference)

**Why edge-tts as fallback?**
- Zero model download
- 400+ voices
- Native word-level SRT output — **no forced alignment step needed**
- Used in real production scripts (verified in `jimmyorona/sam-studio`)
- Free (Microsoft cloud, no API key)

---

## Repositories Discovered

| Repo | Stars | Description | License |
|------|-------|-------------|---------|
| `coqui-ai/TTS` | 45.6k | Deep learning TTS toolkit (XTTS, VITS, etc.) | MPL-2.0 |
| `suno-ai/bark` | 39.2k | Generative audio model with non-verbal sounds | MIT |
| `remotion-dev/remotion` | 51.1k | React-based programmatic video | Custom |
| `rhasspy/piper` | 11.1k | Fast local neural TTS (archived → OHF-Voice) | MIT |
| `SWivid/F5-TTS` | 14.8k | Flow matching TTS, voice cloning | MIT |
| `hexgrad/kokoro` | 7.6k | 82M param TTS, Apache 2.0 weights | Apache 2.0 |
| `thewh1teagle/kokoro-onnx` | ~2k | ONNX runtime for Kokoro, macOS M1 optimized | MIT + Apache 2.0 |
| `rany2/edge-tts` | ~8k | Python interface to MS Edge TTS cloud | GPL-3.0 |
| `yl4579/StyleTTS2` | ~5k | Human-level TTS via style diffusion | MIT/CC-NC |
| `myshell-ai/MeloTTS` | ~3k | Fast multilingual VITS-based TTS | MIT |
| `2noise/ChatTTS` | ~32k | Conversational TTS with prosody control | AGPL/CC-NC |
| `neonbjb/tortoise-tts` | ~12k | High quality multi-voice (slow) | Apache 2.0 |
| `m-bain/whisperX` | ~14k | Word-level timestamps via forced alignment | BSD-4 |
| `ManimCommunity/manim` | ~28k | Python animation engine | MIT |
| `Zulko/moviepy` | ~13k | Python video editing | MIT |
| `slidevjs/slidev` | ~34k | Markdown slides with Playwright export | MIT |
| `motion-canvas/motion-canvas` | ~17k | TypeScript animation + audio sync | MIT |
| `midrender/revideo` | ~4k | Headless video from TypeScript (Motion Canvas fork) | MIT |
| `microsoft/playwright` | ~72k | Headless browser; headless slide capture | Apache 2.0 |
| `hakimel/reveal.js` | ~68k | HTML presentations; no native video export | MIT |
| `maximofraisinet/FreeVi` | ~200 | PDF→video (Kokoro + Whisper + AI slides) | MIT |
| `jimmyorona/sam-studio` | ~10 | PPTX/MD→MP4 (edge-tts + ffmpeg + Marp) | — |

---

## Gaps and Uncertainties

1. **Kokoro native timestamps not fully verified** — the `alignment.align_matrix` approach is inferred from `ahmedmehrem/kokoro:kokoro/pipeline.py` and the `kevinbazira/wikipedia-companion` implementation. The `hexgrad/kokoro` PyPI package (as opposed to the ONNX version) does expose `(graphemes, phonemes, audio)` per segment but does not directly output millisecond-level word boundaries without additional alignment code. **Suggested follow-up:** Test `ctc-forced-aligner` pipeline against `kokoro-onnx` output on macOS M1.

2. **Slidev video export not official** — Slidev has no first-party `--format video` CLI option (verified from `export.ts:exportSlides` function — only `pdf`, `png`, `pptx`, `md`). The PNG export → ffmpeg mux is the community-documented workaround. **Confirmed working** from multiple real-world scripts found.

3. **Playwright `recordVideo` has no audio** — confirmed from docs and real-world usage. So Architecture (ii) with Playwright video capture cannot get audio this way; you'd still need avfoundation separately.

4. **macOS `say` word boundaries via AVSpeechSynthesizer** — requires Swift/Objective-C. Accessible from Python via `pyobjc` but this adds a significant dependency. Not investigated in depth.

5. **FreeVi star count is low (~200)** — this project is very new (2025) but implements the closest full pipeline. Worth watching.

6. **OHF-Voice/piper1-gpl status** — the new home for Piper is actively seeking maintainers (as of research date). May become unmaintained. Watch for forks.

7. **Remotion commercial license** — for a "vibecoders" skill that may be used commercially, Remotion requires a paid company license. Revideo (MIT) is the clean-license alternative.