# Deck & Narration Blueprint

The opinionated, reusable blueprint the skill encodes so every generated deck is structured, self-explanatory, and narration-ready. Distilled from `research/04` (Duarte, Kawasaki, Sequoia, Atkinson, Alley, Tufte, NN/g).

## Default slide sequence — "Project Explainer" (10–12 slides)
Synthesis of Duarte's sparkline × Problem→Solution→Demo→Impact × Sequoia/YC.

| # | Slide | Purpose | Default format |
|---|-------|---------|----------------|
| 0 | **Cover** | Hook + brand first impression | Project name + one-line mission; striking visual |
| 1 | **The Problem** ("What is") | Create empathy; make the pain felt | Bold assertion title + 1 visual/stat; ≤2 sentences |
| 2 | **The Users** | Ground in real human context | Persona quote / vignette; optional persona card |
| 3 | **Insight / Why now** ("What could be") | Position the approach as earned, non-obvious | Single bold assertion; before/after contrast |
| 4 | **The Solution** | The "aha" — reveal the artifact | Product shot / UI / hero diagram; title = *benefit* |
| 5 | **How it works** *(optional for non-tech)* | Credibility; show craft | Simple diagram, ≤3–5 labeled elements |
| 6 | **Key Features / Decisions** | What makes it different | 2–3 cards / before-after pairs (not a bullet list) |
| 7 | **Results / Demo** | Prove it works | Big numbers OR embedded demo; user quote |
| 8 | **What's Next** | Vision beyond today | 3-item timeline (not a gantt) |
| 9 | **Call to Action** | Convert attention → action | One bold sentence + concrete next step |
| 10 | **Team** *(optional)* | Who built it (pitch/hiring) | Faces + 1-line roles |
| 11 | **Appendix** *(optional, not shown live)* | Supporting data/FAQ | Reference only |

This maps 1:1 to `project_brief.json` fields, so Stage 1 directly feeds Stage 3.

## Per-slide design checklist (encode as render rules)
**Content**
- [ ] **One idea per slide** (the cardinal rule).
- [ ] **Title = the takeaway/assertion**, not a topic label (assertion-evidence model, Alley).
- [ ] Body ≤ ~6–12 words on screen; the *script* carries the detail, not the slide.
- [ ] Prefer a **visual** (diagram/screenshot/stat) over bullets; convert lists into cards/diagrams.

**Visual design**
- [ ] High **signal-to-noise** (Tufte): remove chrome, gridlines, logos-on-every-slide.
- [ ] Clear **visual hierarchy**: one dominant element; size/contrast guide the eye.
- [ ] **CRAP**: Contrast, Repetition, Alignment, Proximity.
- [ ] Brand colors from `theme.json`; **≤2 fonts** (heading + body); generous whitespace.
- [ ] Accessible contrast (WCAG AA) for text on background.

**Flow**
- [ ] Each slide advances the story (no "two of the same beat").
- [ ] Transitions imply causality (problem→insight→solution).

## Narration rules (encode in `tts.py` prompt + `narration-rules.md`)
- **Complement, don't repeat:** never read the slide text verbatim; the voice adds the *why/how/story*. (`research/04` §5.1.)
- **Pace:** ~130–150 wpm; **~20–40 words per slide** for a tight explainer (tune to slide).
- **Per-slide micro-structure:** hook → point → bridge to next.
- **Signposting:** "First… / Here's the key part… / Which brings us to…".
- **Conversational tone:** short sentences, second person, contractions; speakable (no unpronounceable tokens, expand symbols/acronyms on first use).
- **Highlight-aware writing:** ensure the **key nouns/verbs that should light up on the slide actually appear in the narration**, so word→span matching is clean (this is what powers the karaoke effect).
- **Open/close:** strong one-line hook on Cover; clear CTA at the end.

## Visual-style adaptation procedure (Stage 2, condensed)
1. **Read coded tokens** (most reliable): DTCG `tokens.json` → Tailwind config → CSS `:root` vars → Style Dictionary output.
2. **Find brand asset:** `public/logo.*`, `favicon.*`, README banner.
3. **Extract palette** from logo (node-vibrant → primary/secondary/accent/bg/dark).
4. **Detect fonts:** `@font-face`, Google Fonts, `@fontsource/*`, bundled files → map to heading/body.
5. **Compose theme:** write `theme.json` → compile `theme.css` reveal.js `:root` variables + a `--brand-highlight` for the karaoke highlight color.
6. **Fallback:** if nothing found, use `assets/default_theme.json` (clean neutral).

## Highlight/motion spec (the signature feature)
- Default highlight: a **smooth background-sweep or color emphasis** on the active word `<span.w.is-spoken>` (CSS transition ~120–180 ms) — readable, not jumpy.
- Optional motion accents: gentle scale/weight bump on emphasis words; fragment reveals timed to narration beats; reveal.js **Auto-Animate** for element morphs between related slides.
- Keep it tasteful: motion should aid comprehension, not distract (design-principles guardrail from `research/04`).
