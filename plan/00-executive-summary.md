# Executive Summary — Project "Deckaster" (working name)

> An Agent Skill that turns any software/design project into a **self-explanatory, brand-styled slide deck**, then into an **AI-narrated video** where the **spoken words highlight themselves on the slide** in real time (karaoke style). Built for designers and "vibecoders" who want a polished explainer without touching a timeline editor.

## The one-liner
**Point it at a project → get back a deck *and* a narrated video that explains itself, in your project's own visual style.**

## Why now / why this is worth building
- **Validated gap (internal):** A WorkIQ scan of Microsoft tenant data found **no end-to-end project** combining auto-deck → AI voice → timeline sync → video. Copilot already nails deck + speaker-note *scripts*; the **voice render, word-timeline sync, and video export are missing**. We're filling a real integration gap. (See `research/00`.)
- **Validated feasibility (external):** Every stage has a mature open-source building block — deck frameworks (reveal.js/Slidev), free TTS with word timestamps (edge-tts), forced alignment (faster-whisper), karaoke rendering (ASS/libass + Playwright), and style extraction (node-vibrant). Nothing here requires research-grade invention. (See `research/01–03, 05`.)
- **Accessibility upside:** Narration + synchronized highlighting is a genuine comprehension/accessibility win, which is a strong adoption narrative.

## What the skill does (5 stages)
1. **Understand the project** — read repo/brief; summarize what it is, who it's for, how it works.
2. **Extract visual style** — pull brand colors, fonts, and logo from the project (design tokens → logo palette) → a deck theme.
3. **Generate a self-explanatory deck** — LLM writes a structured slide spec following a proven 10–12 slide blueprint; rendered to a themed reveal.js/Slidev deck.
4. **Generate the voiceover** — per-slide narration script → TTS audio **with per-word timestamps**.
5. **Render the narrated video** — play the deck, **highlight each word as it's spoken**, capture deterministically, mux audio → `final.mp4`. Also export the standalone deck (HTML/PDF/PPTX) and the narration script.

## Recommended stack (decisive default)
| Concern | Choice | Why |
|---|---|---|
| **Deck engine** | **reveal.js** (HTML/CSS/JS), LLM-authored via a JSON slide spec → template | Best per-element fragment + `<span>` control needed for *in-slide* word highlighting; Playwright-recordable; 72k⭐ MIT. *Slidev is the strong markdown-first alternative.* |
| **Voiceover (default)** | **edge-tts** | Free, 400+ voices, **emits native word-level SRT** → no separate alignment step. |
| **Voiceover (local)** | **Kokoro ONNX** + **faster-whisper** for timestamps | Apache-2.0, ~300 MB, fast on Apple Silicon, fully offline. |
| **Voiceover (premium)** | **ElevenLabs** `/with-timestamps` | Best quality + exact character/word timing. |
| **Word highlight** | reveal.js word `<span>`s driven by `<audio>` `timeupdate` | True on-slide karaoke (what the user asked for). MVP fallback: burned-in **ASS `\kf`** caption bar. |
| **Video render** | **Playwright `recordVideo`** of the live deck + **ffmpeg** mux | Deterministic, headless, captures real CSS animations. Beats live screen-recording (non-reproducible, needs audio loopback). |
| **Style extraction** | design tokens (Tailwind/CSS vars/DTCG) → **node-vibrant** on logo | Exact tokens first; palette-from-logo fallback. |
| **Packaging** | **Agent Skill** (SKILL.md + scripts), modeled on `anthropics/skills` `pptx` | Proven, progressive-disclosure structure. |

## Key design decision: deterministic render, not screen recording
The user's instinct was "use the inbuilt screen recording audio." Research strongly advises **against** live screen-recording (non-reproducible, can't run headless, needs a virtual audio device like BlackHole). Instead we **play the deck headlessly in Playwright, drive the highlight from the audio timeline, and record deterministically** — we still get real animations, but frame-accurate and repeatable. (See `research/02` §Architecture comparison.)

## Scope phasing (MVP → full)
- **MVP (Phase 1–2):** project → themed deck (HTML/PDF) + per-slide narration script. No video yet.
- **Phase 3:** add TTS voiceover + assemble a simple **static-slide video** (image + audio per slide) with an **ASS caption bar** karaoke.
- **Phase 4 (the differentiator):** **in-slide word highlighting** via reveal.js spans + Playwright capture.
- **Phase 5:** motion polish (auto-animate transitions, emphasis animations), multi-voice, export to `.pptx`.

## What we need from you (decisions)
See [`05-open-questions-and-decisions.md`](./05-open-questions-and-decisions.md). The biggest ones: (a) reveal.js vs Slidev, (b) default TTS (free edge-tts vs local Kokoro vs premium ElevenLabs), (c) caption-bar vs true in-slide highlight for v1, (d) primary input (git repo? Figma? a brief?).

## Deliverables of this skill, per run
- `deck.html` (+ `deck.pdf`, optional `deck.pptx`) — the standalone, brand-styled deck
- `narration/` — per-slide scripts + audio + word-timestamp JSON
- `final.mp4` — the narrated, word-highlighted video
- `theme.json` — the extracted visual style (reusable)
