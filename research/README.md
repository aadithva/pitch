# Research Index — "Deck → Narrated Video" Skill

Six research threads were run (5 parallel agents + 1 WorkIQ internal scan) to inform the design of a skill that turns a project into a **self-explanatory deck → AI-narrated video with synced word-highlighting**.

| # | File | Focus | Key takeaway |
|---|------|-------|--------------|
| 0 | [`00-workiq-internal-findings.md`](./00-workiq-internal-findings.md) | Internal (Microsoft) prior-art via WorkIQ | **No internal project does the full pipeline.** Copilot does deck + speaker-note *scripts*; voice render, timeline sync, and video export are all missing → the gap = our idea. Strong accessibility angle. |
| 1 | [`01-deck-frameworks.md`](./01-deck-frameworks.md) | Programmatic deck/slide generators | **Slidev (47k⭐)** and **reveal.js (72k⭐) + Pandoc** are the top engines. HTML path beats `.pptx` for video+animation. **DeckTape** exports per-fragment PNGs. |
| 2 | [`02-slides-to-video-tts.md`](./02-slides-to-video-tts.md) | TTS voiceover + slides→video | **edge-tts** (free, native word SRT) / **Kokoro ONNX** (Apache, local) for voice. **Deterministic frame-by-frame render** beats live screen-recording for reproducibility. |
| 3 | [`03-word-sync-highlight.md`](./03-word-sync-highlight.md) | Word-level sync + karaoke highlight | Prefer **TTS-native timestamps** (edge-tts SRT / ElevenLabs / Azure); fallback **faster-whisper**. Render via **ASS karaoke caption** (simple) or **reveal.js `<span>` + Playwright capture** (true in-slide highlight). |
| 4 | [`04-presentation-bestpractices.md`](./04-presentation-bestpractices.md) | Presentation structure & narration | A **10–12 slide "project explainer" blueprint** (Duarte sparkline × Problem→Solution→Demo→Impact × Sequoia), per-slide design checklist, and narration rules ("complement, don't repeat"). |
| 5 | [`05-skill-format-style.md`](./05-skill-format-style.md) | Agent-skill authoring + style extraction | Model the skill on the official **`anthropics/skills` `pptx` skill** (SKILL.md + scripts + progressive disclosure). Extract brand via **design tokens → node-vibrant/colorthief** on the logo. |

## How to read this
- Start with the **plan** in [`../plan/`](../plan/) — it synthesizes everything below into a concrete build.
- Each research file is self-contained, with comparison tables, GitHub URLs, star counts, licenses, and a final ranked recommendation.

## One-paragraph synthesis
The winning architecture is an **HTML-first pipeline**: an LLM writes a structured slide spec, which is rendered to a **brand-themed reveal.js (or Slidev) deck**; narration is generated per slide via **edge-tts/Kokoro/ElevenLabs** which also yields **per-word timestamps**; those timestamps drive a **karaoke highlight** on the actual slide text; and the playing deck is captured **deterministically** (Playwright `recordVideo` of frame export + ffmpeg) and muxed with the audio into an MP4. The whole thing is packaged as an **Agent Skill** (SKILL.md + bundled scripts) modeled on Anthropic's official `pptx` skill, with **automatic visual-style extraction** from the source project so the deck looks native to it.
