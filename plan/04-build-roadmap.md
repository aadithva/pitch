# Build Roadmap

Phased plan. Each phase is independently shippable and demoable. Effort = rough relative size.

## Phase 0 — Scaffolding & decisions (S)
- Confirm the open decisions in `05-open-questions-and-decisions.md` (engine, TTS, v1 highlight tier, input mode).
- Create the skill skeleton from `02-skill-structure.md` (folders, empty `SKILL.md`, schemas).
- Add `assets/deck_template.html` (reveal.js base) + `assets/default_theme.json`.
- **Exit:** skill is discoverable; `slides.schema.json` + `project_brief.schema.json` defined.

## Phase 1 — Deck generation (M)  ← first visible value
- `extract_style.mjs`: project → `theme.json` + `theme.css` (tokens → logo palette → fonts → fallback).
- Stage-1 prompt: project → `project_brief.json` (validated against schema).
- LLM prompt: `project_brief.json` → `slides.json` (validated; follows blueprint).
- `render_deck.mjs`: `slides.json` + `theme.css` → **`deck.html`** with per-word `<span>`s.
- `export_pdf.mjs`: → `deck.pdf`.
- **Exit / demo:** point at a repo → get a styled, self-explanatory **deck (HTML + PDF)**. *(This alone is already useful and matches the validated internal need.)*

## Phase 2 — Narration scripts (S)
- LLM generates per-slide `narration` (rules from `03-deck-and-narration-blueprint.md`), stored on each slide in `slides.json`.
- Speaker-notes export into the deck (presenter view / notes).
- **Exit:** deck + a clean, complementary narration script per slide.

## Phase 3 — Voiceover + simple video (M)  ← first *video*
- `tts.py` with **edge-tts** default → `sN.mp3` + `sN.words.json` (native SRT timing).
- `make_ass.py`: `words.json` → ASS `\kf` karaoke caption.
- `assemble.py` (MVP path): `slide.png` + `sN.mp3` + `ass` → per-slide clip → **concat → `final.mp4`** with a **caption-bar karaoke**.
- Add `align_words.py` (faster-whisper) as the provider-agnostic timestamp fallback.
- **Exit / demo:** project → **narrated MP4** with synced caption highlighting. End-to-end works.

## Phase 4 — In-slide word highlighting (L)  ← the differentiator
- `assets/highlight.css` + deck JS: `<audio>` `timeupdate` → toggle `.is-spoken` on the spoken word's `<span>`.
- Word→span matcher (order + fuzzy text match) merges `words.json` into `deck.html`.
- `record_video.mjs`: **Playwright** plays the deck (audio + highlight + slide advance) and `recordVideo` → `recording.webm`.
- `assemble.py` (primary path): mux `recording.webm` + concatenated audio → `final.mp4`.
- **Exit / demo:** spoken words **highlight on the actual slide** in the video. This is the headline feature.

## Phase 5 — Motion & polish (M)
- Tasteful motion: emphasis scale/weight on key words, fragment reveals timed to narration, reveal.js **Auto-Animate** transitions.
- Provider expansion: **Kokoro** (local) + **ElevenLabs/Azure** (premium) behind the same `tts.py` interface.
- Optional `.pptx` export (Slidev/Marp image path) for hand-editing.
- Voice/style options (voice pick, pace, theme overrides).

## Phase 6 — Hardening & QA (M)
- QA loop (pptx-skill pattern): render thumbnail grid, check timing drift, verify 100% word-span coverage, contrast/AA check.
- `evals/evals.json`: trigger-phrase discovery + golden-output checks.
- Docs: `references/*.md` finalized; README with examples; sample run on a demo repo.
- Robustness: missing-asset fallbacks, long-deck handling, non-Latin text, no-network mode.

## Milestone summary
| Milestone | Phases | Outcome |
|---|---|---|
| **M1 – Deck** | 0–2 | Branded self-explanatory deck + narration script |
| **M2 – Narrated video (MVP)** | 3 | End-to-end MP4 with caption-bar karaoke |
| **M3 – In-slide karaoke** | 4 | The signature in-slide word-highlight video |
| **M4 – Polished product** | 5–6 | Motion, multi-provider, QA, `.pptx`, evals |

## Risks & mitigations (from research gaps)
- **Word→span match errors** when narration paraphrases the slide → enforce "key words appear in narration" rule (`03`) + fuzzy match + graceful skip.
- **Playwright audio playback headless** quirks → fall back to driving the timeline programmatically (don't rely on real audio playout; advance highlight by computed clock) and mux audio after.
- **Timing drift** in long videos → render per-slide segments and concat (bounded drift).
- **DeckTape/Chromium path on macOS** → prefer Playwright's bundled Chromium; Docker as last resort (`research/01` gaps).
- **edge-tts needs network** → Kokoro/`say` local fallback documented.
