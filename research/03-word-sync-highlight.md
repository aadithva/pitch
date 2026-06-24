
---

# Narration–Slide Synchronization & Karaoke Highlight: Deep Research Report

## Summary

Two parallel problems must be solved: (1) obtaining **per-word timestamps** for any audio narration, and (2) **rendering a visual highlight** that advances in sync with those timestamps on the slide itself. The ecosystem is rich but fragmented. The best-in-class accuracy for post-TTS alignment is **WhisperX** (wav2vec2-based, 22.6k⭐) or **faster-whisper** (23.8k⭐, simpler, built-in word timestamps). The cleanest zero-alignment path is **ElevenLabs `/with-timestamps`** (character-level timestamps emitted by the TTS engine itself). For rendering the highlight, the three viable approaches are: (a) **ASS/SSA karaoke tags + ffmpeg** (pure Python/ffmpeg, burned subtitle overlay), (b) **Reveal.js/HTML + WebVTT + Playwright screen-capture** (true in-slide word highlighting), and (c) **Remotion + `@remotion/captions`** (React-based, highest quality, complex/licensed). A detailed comparison table and final recommendation follow.

---

## Part 1 — Forced Alignment & Word-Level Timestamps

### 1.1 WhisperX

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/m-bain/whisperX |
| **Stars / Maintenance** | 22,648 ⭐ · Actively maintained (pushed 2026-06-03, updated 2026-06-24) |
| **License** | BSD 2-Clause |
| **Stack** | Python; faster-whisper backend + torchaudio wav2vec2 phoneme aligner |
| **Granularity** | **Word-level** (via wav2vec2 forced alignment) |
| **Language support** | English default; French, German, Spanish, Italian via torchaudio; many more via Hugging Face wav2vec2 models |
| **Cloud vs local** | Fully local (GPU recommended, CPU supported with int8) |

**What it solves for us**: Takes any audio (including TTS-generated) → runs Whisper transcription → then runs wav2vec2 phoneme-level forced alignment to snap each word to a precise start/end timestamp. Produces JSON like `{"word": "quick", "start": 1.20, "end": 1.50}`.

**API**:
```python
import whisperx
model = whisperx.load_model("base", device="cpu", compute_type="int8")
result = model.transcribe("audio.mp3")
align_model, metadata = whisperx.load_align_model(language_code="en", device="cpu")
aligned = whisperx.align(result["segments"], align_model, metadata, "audio.mp3", device="cpu")
# aligned["segments"][i]["words"] → list of {word, start, end, score}
```

**Mac notes**: Pass `--compute_type int8 --device cpu`; also works with Apple Silicon via MPS (experimental). The `--highlight_words True` CLI flag generates an SRT with word-level annotation for validation.

**Citation**: `m-bain/whisperX:README.md` — "Accurate word-level timestamps using wav2vec2 alignment"; alignment model list at `whisperx/alignment.py:24-58`

---

### 1.2 faster-whisper

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/SYSTRAN/faster-whisper |
| **Stars / Maintenance** | 23,822 ⭐ · Actively maintained (pushed 2025-11-19) |
| **License** | MIT |
| **Stack** | Python; CTranslate2 inference engine |
| **Granularity** | **Word-level** (Whisper's internal cross-attention pattern) |
| **Language support** | All Whisper languages (99+) |
| **Cloud vs local** | Fully local, CPU and GPU |

**What it solves**: Up to 4× faster than openai-whisper; native `word_timestamps=True` parameter. The word timestamps come from Whisper's own cross-attention weights (DTW method), not from an external aligner, so accuracy is slightly below WhisperX but no extra model is needed.

**API**:
```python
from faster_whisper import WhisperModel
model = WhisperModel("base", device="cpu", compute_type="int8")
segments, _ = model.transcribe("audio.mp3", word_timestamps=True)
for seg in segments:
    for word in seg.words:  # word.word, word.start, word.end, word.probability
        print(word.word, word.start, word.end)
```

`TranscriptionOptions.word_timestamps: bool` at `SYSTRAN/faster-whisper:faster_whisper/transcribe.py:90`

**Note**: For TTS audio (clean speech, known text), faster-whisper's built-in word timestamps are highly accurate — TTS audio is clean, on-script, clear pronunciation.

---

### 1.3 whisper-timestamped

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/linto-ai/whisper-timestamped |
| **Stars / Maintenance** | 2,820 ⭐ · Actively maintained (pushed 2025-09-09) |
| **License** | BSD 2-Clause (files vary, check repo) |
| **Stack** | Python; openai-whisper extension (DTW on cross-attention weights) |
| **Granularity** | **Word-level** with confidence scores |
| **Language support** | All Whisper languages — no extra model download needed |
| **Cloud vs local** | Fully local |

**What it solves**: Like WhisperX, but uses DTW on Whisper's own attention maps instead of an external wav2vec2 model. The big advantage is **no secondary model needed** for any language. The main author notes that `whisper-timestamped` is *more accurate and memory-efficient* than token-probability approaches (whisper.cpp, stable-ts) — the key difference: it uses cross-attention rather than timestamp tokens.

**Comparison with WhisperX** (from `linto-ai/whisper-timestamped:README.md`):
> "An alternative relevant approach involves using wav2vec models that predict characters, as successfully implemented in whisperX. However, these approaches have several drawbacks… The need to find one wav2vec model per language, the need to normalize characters... the lack of robustness around speech disfluencies."

---

### 1.4 stable-ts

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/jianfch/stable-ts |
| **Stars / Maintenance** | 2,263 ⭐ · **ARCHIVED** — "Development indefinitely paused" |
| **License** | MIT |
| **Stack** | Python; openai-whisper fork with stabilized timestamps |
| **Granularity** | Word-level |
| **Cloud vs local** | Fully local |

**What it solves**: Modifies Whisper's decoding to suppress silence and produce more stable word-level timestamps via VAD. Was popular before faster-whisper/WhisperX matured. **Do not start new projects on this** — it is archived. Cited here for completeness.

---

### 1.5 aeneas

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/readbeyond/aeneas |
| **Stars / Maintenance** | 2,846 ⭐ · Semi-active (last pushed June 2024) |
| **License** | **AGPL-3.0** ⚠️ (use cautiously in commercial products) |
| **Stack** | Python/C; requires eSpeak + ffmpeg |
| **Granularity** | **Fragment-level** (sentence/phrase → time interval); word-level only by providing one word per fragment line |
| **Language support** | All eSpeak-supported languages (dozens) |
| **Cloud vs local** | Fully local |

**What it solves**: Classic problem: given a text (book, article) and a human/TTS narration, find the timestamp of each text fragment. Works by synthesizing text via eSpeak internally, then DTW-aligning against the real audio. Ideal for long-form audiobook alignment.

**For our use case**: aeneas is excellent if you have long-form narration and want to align paragraph/sentence-level. For word-level, you'd pass each word on a separate line. But AGPL license and eSpeak dependency make it awkward. Use faster-whisper instead for our TTS use case.

**CLI Example**:
```bash
python -m aeneas.tools.execute_task \
  audio.mp3 text.txt \
  "task_language=eng|os_task_file_format=json|is_text_type=plain" \
  map.json
```
Source: `readbeyond/aeneas:README.md`

---

### 1.6 Gentle

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/strob/gentle |
| **Stars / Maintenance** | 1,699 ⭐ · Somewhat active (pushed May 2026) |
| **License** | MIT |
| **Stack** | Python + Kaldi binaries |
| **Granularity** | Word-level |
| **Language support** | **English only** (CMU Pronouncing Dictionary + Kaldi acoustic model) |
| **Cloud vs local** | Local (Docker recommended) |

**What it solves**: REST API or CLI for word-level forced alignment, built on Kaldi. Very robust for English. REST endpoint: `curl -F "audio=@audio.mp3" -F "transcript=@words.txt" http://localhost:8765/transcriptions?async=false`

**For our use case**: English-only and requires a running server process (or Docker). Too heavy and infrastructure-intensive for an agent skill on macOS. Skip.

---

### 1.7 Montreal Forced Aligner (MFA)

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner |
| **Stars / Maintenance** | 1,840 ⭐ · Actively maintained (pushed June 2026) |
| **License** | MIT |
| **Stack** | Python/Kaldi; conda install |
| **Granularity** | **Phoneme-level** (most precise) |
| **Language support** | Multilingual (many pre-trained models on MFA model repository) |
| **Cloud vs local** | Fully local |

**What it solves**: Acoustic research-grade forced alignment. Outputs Praat TextGrid files with exact phone-level intervals. Best if you need sub-word phoneme timing (e.g., vowel onset).

**For our use case**: Complete overkill. Requires `conda`, Kaldi binaries, pronunciation dictionary, and alignment can take significant time. You'd use MFA if you were doing phoneme-level lip sync or IPA research. For word-level timestamps in an agent skill, use faster-whisper.

---

### 1.8 NeMo Forced Aligner (NVIDIA)

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/NVIDIA-NeMo/NeMo |
| **Stars / Maintenance** | ~13k ⭐ · Actively maintained |
| **License** | Apache 2.0 |
| **Stack** | Python/PyTorch; GPU-focused |
| **Granularity** | Word/character-level (CTC-based NFA module) |
| **Language support** | NeMo-supported languages |
| **Cloud vs local** | Local (GPU required for practical use) |

**For our use case**: Heavy NVIDIA ML framework. Overkill for macOS agent skill. The NFA (NeMo Forced Aligner) module is primarily for aligning long audio to transcripts. Skip unless already using NeMo for TTS.

---

### 1.9 torchaudio CTC Forced Alignment

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/pytorch/audio |
| **API** | `torchaudio.functional.forced_align()`, `torchaudio.pipelines.Wav2Vec2FABundle` |
| **Status** | **DEPRECATED in v2.8, REMOVED in v2.9** ⚠️ |
| **License** | BSD 2-Clause |

**What it solves**: CTC forced alignment via wav2vec2. Now being moved to TorchCodec. **Do not use for new projects** — deprecated as of 2025 per `pytorch/audio:README.md` maintenance transition notice.

---

### 1.10 TTS Engines That Emit Timestamps Directly

#### ElevenLabs (Cloud)

**Source**: `https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps.md`

- Endpoint: `POST /v1/text-to-speech/{voice_id}/with-timestamps`
- Response schema (`AudioWithTimestampsResponseModel`):
  ```yaml
  audio_base64: string  # base64-encoded audio
  alignment:
    characters: [string]                    # each character in the spoken text
    character_start_times_seconds: [float]  # per-character start time
    character_end_times_seconds: [float]    # per-character end time
  normalized_alignment: same structure for normalized text
  ```
- **Granularity**: Character-level (you group adjacent chars per word)
- **Advantage**: No alignment step needed at all — the TTS engine emits timestamps as it generates speech. Perfect accuracy since the audio was generated from these exact timestamps.
- **Also**: ElevenLabs Speech-to-Text API (`/v1/speech-to-text` with `timestamps_granularity=word`) can produce word-level timestamps for existing audio.
- **Integration note**: `@remotion/elevenlabs` package provides `elevenLabsTranscriptToCaptions()` which directly converts to Remotion's `Caption[]` type (Source: `www.remotion.dev/docs/elevenlabs/elevenlabs-transcript-to-captions`).

#### Azure Cognitive Speech (Cloud)

**Source**: `Azure-Samples/cognitive-services-speech-sdk:samples/python/console/speech_synthesis_sample.py:438-465`

```python
speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=..., audio_config=None)

# Subscribes to word boundary event
# evt.audio_offset is in ticks (1 tick = 100 nanoseconds); divide by 10,000 for ms
speech_synthesizer.synthesis_word_boundary.connect(
    lambda evt: print(f"Word: {evt.text}, offset_ms: {evt.audio_offset / 10000}")
)
result = speech_synthesizer.speak_text_async(text).get()
```

- `evt.text` = word text; `evt.audio_offset` = start time in 100ns ticks; `evt.word_length` = character length in source text; `evt.text_offset` = character position in input text
- Also: `evt.boundary_type` distinguishes `Word`, `Punctuation`, `Sentence`
- Also: Viseme events (`synthesis_viseme_received`) give phoneme-level lip position data (22 viseme IDs with Audio offset in 100ns ticks)
- **License**: Proprietary cloud. Python SDK: `pip install azure-cognitiveservices-speech`

#### Piper TTS (Local)

- Fast, local neural TTS (VITS model), runs on macOS CPU
- Does **not** natively emit word timestamps — outputs raw WAV audio only
- Must follow with forced alignment (fastest option: faster-whisper `word_timestamps=True`)
- License: MIT

---

## Part 2 — Karaoke / Synced-Text-Highlight Rendering

### 2.1 ASS/SSA Karaoke Tags + libass + ffmpeg

**Source**: `https://aegisub.org/docs/latest/ass_tags/#karaoke-effect`

The Advanced SubStation Alpha (ASS) format has built-in karaoke tags:

| Tag | Effect |
|-----|--------|
| `\k<duration>` | Instant secondary→primary color flip at word start (duration in centiseconds) |
| `\kf` or `\K<duration>` | Left-to-right color sweep through the word as it's spoken |
| `\ko<duration>` | Outline appears at word start (no fill change) |
| `\kt<time>` | Set absolute start time of next syllable |

**How it works**: All text for a subtitle line sits in **one Dialogue event**. Each word is preceded by a `\k` tag giving its duration in centiseconds. libass calculates the cumulative offset from the event's start time.

**Example ASS snippet**:
```
[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, ...
Style: Karaoke,Arial,72,&H00FFFFFF,&H00FFFF00,&H00000000,...

[Events]
Dialogue: 0,0:00:01.00,0:00:06.00,Karaoke,,0,0,0,,{\kf30}The {\kf42}quick {\kf55}brown {\kf60}fox
```
(Durations: 30cs=0.3s, 42cs=0.42s, etc.)

**Burning into video with ffmpeg**:
```bash
ffmpeg -i presentation_video.mp4 \
       -vf "subtitles=karaoke.ass:fontsdir=/path/to/fonts" \
       -c:a copy output_karaoke.mp4
```

**Python generation pattern**:
```python
def timestamps_to_ass(word_timestamps, start_offset=0.0):
    """Convert [{word, start, end}, ...] to ASS Dialogue line with \kf tags."""
    line_start = word_timestamps[0]["start"]
    line_end   = word_timestamps[-1]["end"]
    parts = []
    prev_end = line_start
    for wt in word_timestamps:
        gap_cs = int((wt["start"] - prev_end) * 100)  # silence gap
        dur_cs = int((wt["end"] - wt["start"]) * 100)  # word duration
        if gap_cs > 0:
            parts.append(f"{{\\kf{gap_cs}}} ")  # silent gap
        parts.append(f"{{\\kf{dur_cs}}}{wt['word']}")
        prev_end = wt["end"]
    text = "".join(parts)
    return f"Dialogue: 0,{format_ts(line_start)},{format_ts(line_end)},Karaoke,,0,0,0,,{text}"
```

**What problem it solves for us**: Renders a karaoke-style word-highlight subtitle OVERLAID on the video. This is a burned-in effect — permanent in the MP4. Fast to generate (pure text file) and render (ffmpeg libass is highly optimized).

**Limitation**: The highlight lives in the subtitle track — it's a floating text bar at the bottom (or wherever positioned). It does NOT highlight the words inside the actual slide content. If the goal is to highlight words *within a slide*, ASS alone doesn't do this.

**Integration notes**: libass is built into most ffmpeg distributions on macOS (via `brew install ffmpeg`). No extra Python packages needed for the generation script.

---

### 2.2 captacity

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/unconv/captacity |
| **Stars / Maintenance** | 138 ⭐ · Last updated June 2024 |
| **License** | MIT |
| **Stack** | Python; MoviePy + OpenAI Whisper |

**What it solves**: End-to-end CLI/library for adding word-highlighted captions to short-form videos (YouTube Shorts style). `highlight_current_word=True` + `word_highlight_color="red"` renders each word in a different color as it's spoken.

**How it works internally** (from README and community research): Uses Whisper for transcription, then renders text frame-by-frame using MoviePy's `TextClip`. For each frame, it calculates which word is currently active based on the timestamp and changes that word's color. It's essentially a MoviePy compositing pipeline.

**For our use case**: This is the **simplest Python-native path** to word-level highlighting burned into video. However:
1. MoviePy-based rendering is slow (renders every frame via PIL/Cairo)
2. The captions are floating subtitle overlays, not within-slide highlights
3. The project has not been updated since June 2024

**Integration notes**:
```python
import captacity
captacity.add_captions(
    video_file="slide_video.mp4",
    output_file="slide_with_captions.mp4",
    highlight_current_word=True,
    word_highlight_color="yellow",
    font_size=80,
    line_count=1,
)
```

---

### 2.3 @remotion/captions

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/remotion-dev/remotion (`packages/captions/`) |
| **Stars (main repo)** | ~21k ⭐ · Actively maintained |
| **License** | **Remotion license** — free for personal/open-source; **company license required** for commercial use |
| **Stack** | TypeScript/React; Node.js rendering via headless Chrome |

**What it solves**: A full React-based video compositing framework where every video frame is a React component. `@remotion/captions` provides the `Caption` type and utilities for word-level subtitle display.

**Caption type** (from `remotion-dev/remotion:packages/captions/src/caption.ts`):
```typescript
export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};
```

**TikTok-style word-by-word captions** (from `remotion-dev/remotion:packages/captions/src/create-tiktok-style-captions.ts`):
```typescript
// Groups captions into "pages" where each page has word-level tokens
export const createTikTokStyleCaptions = ({ captions, combineTokensWithinMilliseconds }) => {
  // Returns { pages: TikTokPage[] }
  // Each TikTokPage has: text, startMs, tokens: TikTokToken[]
  // Each TikTokToken has: text, fromMs, toMs
};
```

**Supported caption sources** (from `www.remotion.dev/docs/captions/api`):
- `@remotion/install-whisper-cpp` → `toCaptions()` (local whisper.cpp)
- `@remotion/whisper-web` → `toCaptions()` (browser Whisper WASM)
- `@remotion/openai-whisper` → `openAiWhisperApiToCaptions()` (OpenAI API)
- `@remotion/elevenlabs` → `elevenLabsTranscriptToCaptions()` (ElevenLabs STT)

**Remotion whisper.cpp example output** (from `www.remotion.dev/docs/install-whisper-cpp/to-captions`):
```json
[
  {"text": "William", "startMs": 40, "endMs": 420, "timestampMs": 240, "confidence": 0.81},
  {"text": " just",   "startMs": 420, "endMs": 650, "timestampMs": 480, "confidence": 0.99},
  {"text": " hit",    "startMs": 650, "endMs": 810, "timestampMs": 700, "confidence": 0.98}
]
```

**License consideration**: Remotion is **NOT MIT**. From the GitHub README: "Be aware that Remotion has a special license and requires obtaining a company license in some cases." For an open-source/personal agent skill, Remotion is free. For a commercial product, a license is required. This is a significant consideration.

**For our use case**: Remotion is powerful but requires Node.js/React, has a complex build pipeline, and commercial licensing. It's ideal if the agent generates React-based slide videos (like Remotion templates for slides exist). But it's a different paradigm from Python/ffmpeg.

---

### 2.4 Reveal.js Fragment Animation + WebVTT Timing

**What Reveal.js provides out of the box**:
- Fragment reveals: `.fragment` class elements are shown one-by-one on advance
- auto-animate: morphs elements between slides
- **Neither is driven by a timeline** — both are event-driven (keyboard/click)

**What you'd need to add for word-highlight**:
1. At slide-generation time: wrap each word in `<span data-word="N" data-start="1.23" data-end="1.56">word</span>`
2. A tiny JS plugin that:
   - Attaches a `timeupdate` listener to the `<audio>` element playing the narration
   - On each tick: finds the `<span>` whose `data-start ≤ currentTime < data-end` and adds `.highlight` class (removing from others)
3. CSS: `.highlight { background: yellow; transition: background 0.05s; }`

**For recording to video**:
- Use Playwright/Puppeteer to open the HTML page with audio autoplay
- Screen-capture the browser using ffmpeg's `x11grab` / Playwright's video recording
- Merge captured video with narration audio using ffmpeg

**WebVTT approach** (alternative):
- Generate a `.vtt` file with `<c.highlight>word</c>` cue formatting
- HTML5 `<video>` with `<track kind="subtitles" src="narration.vtt">` 
- CSS `::cue(c.highlight)` styling
- Limitation: VTT `::cue` styling only affects the subtitle overlay, not in-slide content

**For our use case**: The **`<span data-start data-end>` + JS timeupdate** approach is the cleanest way to truly highlight words *within the slide body*. This requires the slide be HTML-based (which Reveal.js and Slidev are).

---

### 2.5 MoviePy TextClip Approach

**Source**: `https://github.com/Zulko/moviepy`

MoviePy (MIT, actively maintained, Python) allows generating video from code using PIL/Cairo:
```python
from moviepy import VideoFileClip, TextClip, CompositeVideoClip

# For each word, create a TextClip visible only during that word's time window
def make_word_highlight_clip(word_timestamps, video_duration, highlight_color="yellow"):
    clips = []
    for i, wt in enumerate(word_timestamps):
        # Reconstruct full sentence with one word highlighted
        sentence = "".join(
            f"[{w['word']}]" if j == i else w['word']
            for j, w in enumerate(word_timestamps)
        )
        txt = TextClip(sentence, fontsize=60, color='white', ...)
             .set_start(wt['start']).set_end(wt['end'])
        clips.append(txt)
    return clips
```

**What it solves**: Full Python control over the rendered output. Can composite text on top of slide frames.

**For our use case**: Works but slow (renders each frame in Python). Best for short presentations or quick prototyping. The captacity library is essentially a wrapper around this pattern.

---

### 2.6 auto-subtitle

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/m1guelpf/auto-subtitle |
| **Stars** | ~11k ⭐ · MIT |
| **Stack** | Python + ffmpeg |

**What it solves**: Burns Whisper-generated subtitles into video via ffmpeg. **Segment-level** (whole phrases as subtitle events). Does NOT support word-level highlighting. It's purely SRT → hard-coded subtitles. Not suitable for karaoke-style highlighting.

---

## Comparison Table: Timestamp Acquisition

| Tool | Method | Granularity | Local/Cloud | Language Support | License | Maintenance | macOS Ease |
|------|--------|-------------|-------------|-----------------|---------|-------------|------------|
| **WhisperX** | Whisper + wav2vec2 FA | Word ✅ | Local (CPU OK) | En + many via HF | BSD-2 | Active | `pip install whisperx` |
| **faster-whisper** | CTranslate2 Whisper | Word ✅ | Local (CPU OK) | 99 languages | MIT | Active | `pip install faster-whisper` |
| **whisper-timestamped** | DTW on cross-attention | Word ✅ | Local (CPU OK) | All Whisper | BSD-2 | Active | `pip install whisper-timestamped` |
| **stable-ts** | Whisper token timestamps | Word ✅ | Local (CPU OK) | All Whisper | MIT | **ARCHIVED** ⚠️ | `pip install stable-ts` |
| **aeneas** | DTW vs eSpeak synth | Fragment/Line ⚠️ | Local | Many (eSpeak) | **AGPL-3** ⚠️ | Semi-active | Complex (eSpeak dep) |
| **Gentle** | Kaldi FA | Word ✅ | Local (server) | English only | MIT | Semi-active | Docker needed |
| **MFA** | Kaldi phoneme FA | Phoneme ✅✅ | Local | Many models | MIT | Active | conda install |
| **torchaudio FA** | CTC wav2vec2 | Word/Phoneme | Local | Limited | BSD-2 | **DEPRECATED** ⚠️ | N/A |
| **ElevenLabs /with-timestamps** | TTS-native | **Character** ✅✅ | **Cloud** | All ElevenLabs | Proprietary | Active | REST API |
| **Azure Speech word boundary** | TTS-native callback | **Word** ✅ | **Cloud** | Many | Proprietary | Active | Python SDK |
| **Piper TTS** | Local TTS (no timestamps) | None built-in | Local | Many voices | MIT | Active | needs aligner |

---

## Comparison Table: Highlight Rendering

| Approach | Highlights Within Slide? | Stack | Speed | Flexibility | License | Complexity |
|----------|--------------------------|-------|-------|-------------|---------|------------|
| **ASS karaoke + ffmpeg** | ❌ Subtitle overlay | Python gen + ffmpeg | ⚡ Very fast | Color, fonts, position | MIT/BSD | Low |
| **captacity (MoviePy)** | ❌ Subtitle overlay | Python | 🐢 Slow | Good | MIT | Low |
| **Reveal.js + JS timeupdate** | ✅ Within slide | HTML/JS + Playwright | 🐢 Moderate | Full CSS/HTML | MIT | Medium |
| **@remotion/captions** | ✅ Within video component | React/Node | ⚡ Fast render | React ecosystem | **Commercial** ⚠️ | High |
| **MoviePy TextClip custom** | ✅ (with effort) | Python | 🐢 Very slow | Full Python | MIT | High |
| **WebVTT + ::cue CSS** | ❌ Subtitle track only | HTML | ⚡ Instant | Limited by CSS spec | Standard | Low |

---

## Final Recommended Technical Approach

### Decision A: Timestamp Source — TTS-native vs. Post-TTS Alignment

**Use TTS-native timestamps whenever possible.** ElevenLabs is the clear winner here:
- Call `POST /v1/text-to-speech/{voice_id}/with-timestamps` 
- Get `alignment.characters[]` + `character_start_times_seconds[]` + `character_end_times_seconds[]`
- Group consecutive characters into words: scan for space boundaries
- Result: exact word-level `{word, start_sec, end_sec}` list with no alignment step
- Accuracy is provably perfect (same engine that generated the audio)

**For local/offline TTS** (Piper or macOS `say`): use `faster-whisper` with `word_timestamps=True`. It runs on CPU in int8 mode on macOS, is 4× faster than openai-whisper, and the timestamps are reliable for clean TTS audio. No extra model download needed (just the Whisper model).

**WhisperX is the fallback** for highest accuracy with any TTS or real-world audio, at the cost of needing a wav2vec2 model per language.

```
PRIORITY ORDER for an agent skill:
1. ElevenLabs /with-timestamps  → character-level, no alignment needed
2. Azure Speech word_boundary   → word-level, during synthesis
3. faster-whisper word_timestamps=True  → local, any audio, fast
4. WhisperX                     → local, highest accuracy, needs aligner model
```

### Decision B: Highlight Rendering — ASS Karaoke vs. HTML/JS vs. Remotion

This decision hinges on **WHERE the highlight must appear**:

**Scenario 1: Highlight is a caption bar synced to narration** (like standard karaoke)
→ Use **ASS/SSA `\kf` tags + ffmpeg subtitle burn-in**. This is the simplest, fastest, and most portable approach. Pure Python to generate the ASS file; ffmpeg handles rendering.

**Scenario 2: Highlight appears on the actual text within the slide** (true on-deck karaoke)
→ Use **Reveal.js HTML slides + JS `timeupdate` listener + Playwright screen capture**.

**Concrete recommended pipeline for the agent skill**:

```
┌─────────────────────────────────────────────────────────────────┐
│  SKILL PIPELINE (macOS, Python/Node/ffmpeg)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PROJECT INPUT                                               │
│     └─> Extract style + content                                  │
│                                                                  │
│  2. GENERATE SLIDE HTML (Reveal.js)                             │
│     └─> Wrap each word in <span data-word-id="N">               │
│         (done during slide content generation)                   │
│                                                                  │
│  3. GENERATE NARRATION                                          │
│     └─> ElevenLabs TTS: POST /with-timestamps                   │
│         OR: Piper TTS → faster-whisper word_timestamps=True     │
│         → Produces: audio.mp3 + word_timestamps.json            │
│                                                                  │
│  4. INJECT TIMING INTO SLIDE                                    │
│     └─> Python script merges word_timestamps.json into          │
│         slide_data.json (matches narration words to             │
│         span data-word-id by text matching)                      │
│                                                                  │
│  5. RENDER VIDEO WITH HIGHLIGHTS                                │
│     Option A (caption overlay — simpler):                        │
│       └─> generate_ass.py: timestamps → karaoke.ass             │
│       └─> ffmpeg: slide_video.mp4 + audio.mp3 +                 │
│               -vf "subtitles=karaoke.ass" → final.mp4           │
│                                                                  │
│     Option B (in-slide highlighting — richer):                   │
│       └─> Playwright opens slide.html with audio                │
│       └─> JS timeupdate loop drives <span> highlight classes    │
│       └─> Playwright records video → raw.mp4                    │
│       └─> ffmpeg mux: raw.mp4 + audio.mp3 → final.mp4          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Minimal Viable Implementation (Python snippet for ASS karaoke from ElevenLabs timestamps)

```python
import requests, base64, json

def get_audio_with_timestamps(text: str, voice_id: str, api_key: str):
    """Call ElevenLabs /with-timestamps and return (audio_bytes, word_timestamps)."""
    resp = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps",
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        json={"text": text, "model_id": "eleven_multilingual_v2"},
    )
    data = resp.json()
    audio = base64.b64decode(data["audio_base64"])
    
    # Group characters into words
    chars = data["alignment"]["characters"]
    starts = data["alignment"]["character_start_times_seconds"]
    ends   = data["alignment"]["character_end_times_seconds"]
    words = []
    current_word, word_start, word_end = "", None, None
    for ch, s, e in zip(chars, starts, ends):
        if ch == " " and current_word:
            words.append({"word": current_word, "start": word_start, "end": word_end})
            current_word, word_start, word_end = "", None, None
        else:
            if not current_word: word_start = s
            current_word += ch
            word_end = e
    if current_word:
        words.append({"word": current_word, "start": word_start, "end": word_end})
    return audio, words

def words_to_ass(words: list, style_name="Karaoke") -> str:
    """Generate ASS content from word timestamp list."""
    def cs(secs): return int(secs * 100)  # centiseconds
    def ass_ts(secs):
        h = int(secs // 3600); m = int((secs % 3600) // 60); s = secs % 60
        return f"{h}:{m:02d}:{s:06.2f}"[:-1]  # H:MM:SS.CC
    
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV
Style: Karaoke,Arial,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,1,2,0,2,10,10,50

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
    # Group words into chunks of ~8 words per line
    chunk_size = 8
    events = []
    for i in range(0, len(words), chunk_size):
        chunk = words[i:i+chunk_size]
        line_start = chunk[0]["start"]
        line_end   = chunk[-1]["end"]
        parts = []
        prev_end = line_start
        for wt in chunk:
            gap_cs = max(0, cs(wt["start"]) - cs(prev_end))
            dur_cs = cs(wt["end"]) - cs(wt["start"])
            if gap_cs > 0:
                parts.append(f"{{\\kf{gap_cs}}} ")
            parts.append(f"{{\\kf{dur_cs}}}{wt['word']} ")
            prev_end = wt["end"]
        text = "".join(parts).rstrip()
        events.append(
            f"Dialogue: 0,{ass_ts(line_start)},{ass_ts(line_end)},"
            f"{style_name},,0,0,0,,{text}"
        )
    return header + "\n".join(events)
```

---

## Gaps, Uncertainties & Notes

1. **Piper TTS timestamps**: Confirmed Piper does NOT emit word timestamps natively (it outputs WAV only). Inference was based on README and architecture documentation. To confirm phoneme timing from Piper, would need to examine its JSON output format or use a separate aligner.

2. **Remotion commercial license details**: Remotion's license page returned 404 during this research session. From the README: "requires obtaining a company license in some cases." The exact revenue threshold and scope need to be verified at `www.remotion.dev/docs/licenses` (try a direct browser visit). For a personal/open-source agent skill, Remotion appears free under its standard license.

3. **torchaudio FA deprecation**: Confirmed deprecated in 2.8 and removed in 2.9 per `pytorch/audio:README.md`. Do not use.

4. **stable-ts archival**: Confirmed via `jianfch/stable-ts:README.md` — "Development on this repository is indefinitely paused."

5. **NeMo forced aligner specifically**: The NeMo NFA module lives in `nemo/collections/asr/parts/utils/nfa/` — not separately investigated since NeMo is too heavy for our use case. Verified it exists but skipped deep-dive.

6. **Reveal.js + Playwright recording**: This was inferred as technically feasible based on Playwright's built-in video recording feature (`page.video.path()`) and known integration patterns. The specific cross-timing implementation (WebVTT cues vs. `timeupdate` listener) has not been tested.

7. **Apple Silicon (M-series Mac)**: WhisperX and faster-whisper both work on Apple Silicon via CPU (int8) and experimentally via MPS. ElevenLabs is cloud. For the recommended pipeline, all local components work on macOS ARM64.

8. **ElevenLabs character → word grouping**: The `/with-timestamps` response gives character-level data. The word-grouping code shown above is correct in principle but would need to handle punctuation, contractions ("don't" → ["d","o","n","'","t"]), and normalized text (numbers → words, if `apply_text_normalization=auto`).

---

## Source Index (All Citations)

| Source | URL |
|--------|-----|
| WhisperX README | https://github.com/m-bain/whisperX |
| WhisperX alignment.py | https://github.com/m-bain/whisperX/blob/main/whisperx/alignment.py |
| faster-whisper README | https://github.com/SYSTRAN/faster-whisper |
| faster-whisper transcribe.py | github.com/SYSTRAN/faster-whisper:faster_whisper/transcribe.py |
| whisper-timestamped README | https://github.com/linto-ai/whisper-timestamped |
| stable-ts README | https://github.com/jianfch/stable-ts |
| aeneas README | https://github.com/readbeyond/aeneas |
| Gentle README | https://github.com/strob/gentle |
| MFA docs | https://montreal-forced-aligner.readthedocs.io/en/latest/ |
| MFA GitHub | https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner |
| NeMo GitHub | https://github.com/NVIDIA-NeMo/NeMo |
| torchaudio FA tutorial | https://docs.pytorch.org/audio/main/tutorials/ctc_forced_alignment_api_tutorial.html |
| ElevenLabs /with-timestamps spec | https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps.md |
| ElevenLabs /with-timestamps response schema | `CharacterAlignmentResponseModel` in above spec |
| Azure Speech SDK sample (word boundary) | Azure-Samples/cognitive-services-speech-sdk:samples/python/console/speech_synthesis_sample.py:438-465 |
| Azure SSML docs | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-structure |
| Azure Viseme docs | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme |
| ASS karaoke tags | https://aegisub.org/docs/latest/ass_tags/#karaoke-effect |
| captacity README | https://github.com/unconv/captacity |
| Remotion main README | https://github.com/remotion-dev/remotion |
| @remotion/captions API | https://www.remotion.dev/docs/captions/api |
| @remotion/captions Caption type | remotion-dev/remotion:packages/captions/src/caption.ts |
| @remotion/captions createTikTokStyleCaptions | remotion-dev/remotion:packages/captions/src/create-tiktok-style-captions.ts |
| Remotion install-whisper-cpp toCaptions | https://www.remotion.dev/docs/install-whisper-cpp/to-captions |
| Remotion ElevenLabs transcript | https://www.remotion.dev/docs/elevenlabs/elevenlabs-transcript-to-captions |
| MoviePy README | https://github.com/Zulko/moviepy |
| auto-subtitle README | https://github.com/m1guelpf/auto-subtitle |
| OpenAI Whisper README | https://github.com/openai/whisper |