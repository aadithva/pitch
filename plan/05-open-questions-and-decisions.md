# Open Questions & Decisions

Decisions that shape the build. Each has a **recommended default** (so we can proceed without blocking), but your call changes scope. Grouped by impact.

## 🔴 High impact — please confirm before/at Phase 0

### Q1. Deck engine: reveal.js vs Slidev
- **Recommend: reveal.js.** Best raw `<span>`/fragment control for *in-slide* word highlighting + cleanest Playwright capture; 72k⭐ MIT. (`research/01`, `research/03`.)
- **Alternative: Slidev** — markdown-first, prettier defaults, but Vue layer adds friction for per-word span injection.
- *Trade-off:* reveal.js = more control for the karaoke feature; Slidev = nicer authoring/aesthetics out of the box.

### Q2. Default TTS provider
- **Recommend: edge-tts** (free, no key, native word-level SRT → no alignment step).
- **Local option: Kokoro ONNX** (Apache, offline, ~300 MB) + faster-whisper for timing.
- **Premium option: ElevenLabs** (best quality, exact timestamps, paid key).
- *Question:* is **free + online** OK as the default, or do you need **fully offline** (→ Kokoro) or **top-tier voice** (→ ElevenLabs) from day one?

### Q3. v1 highlight tier: caption-bar vs true in-slide
- The user vision = **in-slide** word highlighting (Phase 4).
- **Recommend: ship caption-bar karaoke first (Phase 3)** as the MVP, then in-slide (Phase 4).
- *Question:* OK to land the simpler caption-bar video first, or go straight for in-slide highlighting?

### Q4. Primary project input
- **Recommend v1: a local folder / git repo** (richest signal: code, README, brand assets).
- Other modes: a written **brief/markdown**, a **URL**, or **Figma** (design source).
- *Question:* what's the main input you'll point this at — a **repo**, a **Figma file**, or a **brief**? (Affects Stage-1 + Stage-2 extractors.)

## 🟠 Medium impact — can default, revisit later

### Q5. Render strategy
- **Recommend: deterministic Playwright `recordVideo`** (reproducible, headless, real animations) — **not** live OS screen-recording.
- Note: this overrides the original "inbuilt screen recording audio" idea, for reliability. (`research/02`.) Confirm you're OK with that.

### Q6. Standalone deck deliverables
- **Recommend:** always emit `deck.html` + `deck.pdf`. Add **`.pptx`** export in Phase 5.
- *Question:* is an editable **`.pptx`** important (some audiences expect it), or are HTML/PDF/MP4 enough?

### Q7. Deck length & tone defaults
- **Recommend:** 10–12 slides, professional-but-friendly tone, ~130–150 wpm narration.
- *Question:* a fixed length, or adaptive to project size? Any tone preset (corporate / playful / technical)?

### Q8. Target runtime & install footprint
- **Recommend:** macOS-first (your env), Node + Python + ffmpeg; keep cloud APIs opt-in.
- *Question:* must it also run on Linux/CI cleanly from day one (affects Chromium/ffmpeg packaging)?

## 🟡 Lower impact — defaults are fine unless you object

### Q9. Skill name
- Working name **`deck-to-video`** (clear trigger). Open to a brand name (e.g., "Deckaster", "Narrate").

### Q10. Diagrams for "How it works"
- **Recommend:** auto-generate simple **Mermaid/SVG**; use provided screenshots when available.

### Q11. Languages
- **Recommend:** English v1; edge-tts/Whisper support many languages → multilingual later.

### Q12. Licensing
- Pick a license (MIT keeps it open and matches most deps). ElevenLabs/Azure remain user-supplied keys.

---

## Suggested decision path
If you just want momentum, accept all **Recommends** above and we proceed to Phase 0–1 (deck generation) immediately, landing a styled deck first, then the caption-bar video, then the in-slide karaoke. The only ones truly worth a moment's thought now are **Q1 (engine)**, **Q2 (TTS)**, and **Q4 (input)** — everything else can flex later.
