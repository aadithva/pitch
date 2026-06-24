# Skill Structure & Authoring Plan

How we package this as an **Agent Skill**, modeled on the official `anthropics/skills` `pptx` skill (the production model dissected in `research/05` §1.2). Spec: <https://agentskills.io/specification>.

## Folder layout (progressive disclosure)
```
deck-to-video/                      # dir name MUST equal frontmatter `name`
├── SKILL.md                        # Level 2: workflow + selection logic (<500 lines)
├── references/                     # Level 3: loaded only when needed
│   ├── deck-blueprint.md           #   slide sequence + per-slide design rules
│   ├── narration-rules.md          #   script-writing rules + pacing
│   ├── theming.md                  #   style-extraction + reveal.js theme mapping
│   ├── tts-providers.md            #   edge-tts / kokoro / elevenlabs / say setup
│   └── video-pipeline.md           #   Playwright capture + ffmpeg/ASS details
├── scripts/
│   ├── extract_style.mjs           #   project → theme.json (+theme.css)
│   ├── render_deck.mjs             #   slides.json + theme → deck.html (+word spans)
│   ├── export_pdf.mjs              #   deck.html → deck.pdf (DeckTape/Playwright)
│   ├── tts.py                      #   narration → mp3 + words.json (provider-pluggable)
│   ├── align_words.py              #   audio+text → words.json (faster-whisper fallback)
│   ├── make_ass.py                 #   words.json → karaoke .ass (MVP caption path)
│   ├── record_video.mjs            #   Playwright: play deck+highlight → recording.webm
│   └── assemble.py                 #   ffmpeg mux/concat → final.mp4
├── assets/
│   ├── deck_template.html          #   reveal.js base template (slots for theme+slides)
│   ├── highlight.css               #   .w / .is-spoken karaoke styles + motion
│   └── default_theme.json          #   neutral fallback theme
├── schemas/
│   ├── slides.schema.json          #   the LLM's deck output contract
│   └── project_brief.schema.json   #   stage-1 understanding contract
├── evals/
│   └── evals.json                  #   test prompts (per skill-creator convention)
└── LICENSE.txt
```

**Rationale (from `research/05`):** the `pptx` skill keeps `SKILL.md` lean (~9 KB) and pushes detail into level-3 files (`pptxgenjs.md`, `editing.md`) and self-contained `scripts/`. We mirror that: `SKILL.md` is the *router*; everything heavy lives in `references/` and `scripts/`.

## SKILL.md design

### Frontmatter (the discovery trigger — write it keyword-rich)
```yaml
---
name: deck-to-video
description: >-
  Use this skill whenever the user wants to turn a project, codebase, design,
  or brief into a presentation deck and/or a narrated explainer video. Triggers
  on: "make a deck", "slides", "presentation", "pitch", "explainer video",
  "demo video", "voiceover", "narrate my project", "walkthrough video",
  "turn this repo into a video". Produces a brand-styled, self-explanatory
  slide deck AND an AI-narrated MP4 where spoken words highlight on the slide
  (karaoke-style). Use any time a deck, slides, or narrated video is requested.
license: <TBD>
---
```
> Mirrors the `pptx` skill's "pushy", synonym-dense description (≤1024 chars) so the agent reliably auto-selects it. (`research/05` §1.2.)

### Body (Level 2) — outline
1. **What this skill produces** (deck.html/pdf, narration, final.mp4, theme.json).
2. **Quick-reference workflow table** → which script + which reference file per stage.
3. **Decision gates** the agent must resolve with the user *up front*: TTS provider, video tier (caption-bar vs in-slide highlight), deck length.
4. **The 5-stage workflow** (each stage: 2–4 lines + pointer to a `references/*.md`).
5. **Dependencies & setup** (declared explicitly, like the pptx skill does).
6. **QA loop** (render thumbnails, check timing drift, verify word-span coverage) — adopt the pptx skill's "visual QA via thumbnails + subagent inspection" pattern.

## Authoring rules we will follow (from skill-creator, `research/05` §1.5)
- `SKILL.md` **< 500 lines**; push detail to `references/` with explicit "read this when…" pointers.
- **All "when to use" guidance lives in the `description`,** not the body.
- Scripts are **self-contained, idempotent, CLI-invokable** with docstring usage, `stderr` errors, `sys.exit(1)` on failure (pptx `add_slide.py` pattern).
- **Declare every dependency** in the body; don't assume preinstalled libs.
- Provide **`evals/evals.json`** with a few trigger prompts to validate discovery + output.
- Pitfall guard (from pptx): hex colors handling, XML-safe libs, etc., documented inline where relevant.

## Script contracts (stable interfaces)
| Script | In | Out |
|---|---|---|
| `extract_style.mjs <projectDir>` | project files | `theme.json`, `theme.css` |
| `render_deck.mjs <slides.json> <theme.css>` | spec + theme | `deck.html` (word-spanned) |
| `export_pdf.mjs <deck.html>` | deck | `deck.pdf` |
| `tts.py --provider <p> <narration.json>` | scripts | `sN.mp3`, `sN.words.json` |
| `align_words.py <audio> <text>` | audio+text | `words.json` (fallback) |
| `make_ass.py <words.json>` | timings | `karaoke.ass` |
| `record_video.mjs <deck.html> <audioDir>` | deck+audio | `recording.webm` |
| `assemble.py <recording|frames> <audio>` | media | `final.mp4` |

Keeping these contracts stable lets stages be developed/tested independently and lets the agent swap providers without touching the rest.

## Distribution
- Primary: a folder skill droppable into `~/.claude/skills/` or this repo's skill dir.
- Keep zero hard requirement on cloud APIs (edge-tts + Kokoro keep it free/local); cloud providers are opt-in via env vars.
