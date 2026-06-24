# Deck Blueprint

The default structure for a "project explainer" deck. Synthesizes Duarte's
sparkline, the Problem→Solution→Demo→Impact arc, and Sequoia/YC structure.
(Full sourcing in the repo `plan/03-deck-and-narration-blueprint.md`.)

## Default sequence (10–12 slides)
| # | `type` | Purpose | Default format |
|---|--------|---------|----------------|
| 0 | `cover` | Hook + brand first impression | Name + one-line mission |
| 1 | `problem` | Make the pain felt | Assertion title + 1 visual/stat; ≤2 sentences |
| 2 | `users` | Ground in real people | Persona quote / vignette |
| 3 | `insight` | Position the approach as earned | Single bold assertion; before/after |
| 4 | `solution` | The "aha" — reveal the artifact | Product shot / hero; title = *benefit* |
| 5 | `how` | Credibility; show craft | Simple diagram, ≤3–5 elements |
| 6 | `features` | What's different | 2–3 cards (not a bullet list) |
| 7 | `results` | Prove it works | Big number OR demo; user quote |
| 8 | `next` | Vision beyond today | 3-item list (not a gantt) |
| 9 | `cta` | Convert attention → action | One bold line + concrete step |
| 10 | `team` *(opt)* | Who built it | Cards (name + role) |
| 11 | `appendix` *(opt)* | Backup data/FAQ | Reference only |

Map `project_brief.json` fields onto these slides directly.

## Per-slide design rules (the renderer + you enforce these)
**Content**
- One idea per slide.
- **Title = the takeaway/assertion**, not a topic label.
- ≤ ~6–12 words of on-screen body; the *script* carries detail.
- Prefer a visual (diagram/screenshot/stat) over bullets.

**Visual**
- High signal-to-noise; remove chrome.
- One dominant element; clear hierarchy.
- Brand colors from `theme.json`; ≤2 fonts; generous whitespace.
- Maintain readable contrast (WCAG AA) — the dark base theme handles this.

**Flow**
- Each slide advances the story (no repeated beats).
- Transitions imply causality: problem → insight → solution → proof.

## Length & tone defaults
- 10–12 slides; professional-but-friendly; concise.
- If the project is small, drop `users`/`team`/`appendix`. If large, keep `how`
  and `results` substantial.
