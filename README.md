# Deck → Narrated Video Skill — Research & Plan

> An **Agent Skill** that turns any project into a **self-explanatory, brand-styled deck**, then an **AI-narrated video** where **spoken words highlight on the slide** in real time (karaoke-style). For designers and "vibecoders".

This repo currently contains the **research and plan** (no implementation yet).

## 📌 Start here
- **[`plan/00-executive-summary.md`](plan/00-executive-summary.md)** — the big picture, recommended stack, scope.
- **[`plan/05-open-questions-and-decisions.md`](plan/05-open-questions-and-decisions.md)** — the few decisions needed to start building.

## 🗂 Structure
```
research/   # 6 deep-dive reports (5 parallel agents + 1 internal WorkIQ scan)
plan/       # synthesized, opinionated build plan
```

### Plan
| File | What it covers |
|---|---|
| [`plan/00-executive-summary.md`](plan/00-executive-summary.md) | Vision, why-now, recommended stack, phasing |
| [`plan/01-architecture.md`](plan/01-architecture.md) | End-to-end pipeline, stage-by-stage, data contracts |
| [`plan/02-skill-structure.md`](plan/02-skill-structure.md) | Skill folder layout, SKILL.md design, script contracts |
| [`plan/03-deck-and-narration-blueprint.md`](plan/03-deck-and-narration-blueprint.md) | 10–12 slide blueprint, design checklist, narration rules |
| [`plan/04-build-roadmap.md`](plan/04-build-roadmap.md) | Phased, demoable milestones (deck → MVP video → in-slide karaoke) |
| [`plan/05-open-questions-and-decisions.md`](plan/05-open-questions-and-decisions.md) | Decisions with recommended defaults |

### Research
See **[`research/README.md`](research/README.md)** for the index. Six reports cover: internal prior-art (WorkIQ), deck frameworks, TTS+slides-to-video, word-sync/karaoke, presentation best-practices, and skill-format + style-extraction — each with comparison tables, GitHub links, stars, licenses, and ranked recommendations.

## 🧱 Recommended stack (TL;DR)
**reveal.js** deck (LLM-authored spec → themed HTML) · **edge-tts/Kokoro/ElevenLabs** voice with **per-word timestamps** · **in-slide `<span>` highlight** driven by audio timeline · **Playwright `recordVideo` + ffmpeg** for deterministic render · **node-vibrant/design-token** style extraction · packaged like Anthropic's official **`pptx`** skill.

## ✅ Key validated insights
1. **Novel internally** — WorkIQ found no Microsoft project doing the full deck→voice→sync→video pipeline; the pieces exist in isolation.
2. **Feasible externally** — every stage has a mature open-source building block; no research-grade invention required.
3. **Deterministic render > screen recording** — Playwright capture gives real animations *and* reproducibility.
4. **The differentiator is the in-slide karaoke highlight** — keep narration "key words" present on slides to make word→span matching clean.

## ▶️ Next step
Confirm **Q1 (engine), Q2 (TTS), Q4 (input)** in [`plan/05`](plan/05-open-questions-and-decisions.md) and we begin **Phase 0–1: deck generation**.
