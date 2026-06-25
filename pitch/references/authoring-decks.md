# Authoring `slides.json`

The deck is generated from a `slides.json` you (the agent) write. Full contract:
`schemas/slides.schema.json`. This file explains how to use it well.

## Shape
```json
{
  "title": "Project — Explainer",
  "slides": [ { "type": "cover", "title": "...", "narration": "..." }, ... ]
}
```
A bare top-level array `[ {slide}, ... ]` is also accepted.

## Slide object
| Field | Use |
|-------|-----|
| `type` | Semantic role → picks a default layout. One of: `cover, problem, users, insight, solution, how, features, results, next, cta, team, appendix, content, statement`. |
| `layout` | Optional override: `title, statement, split, cards, stat, diagram, list, closing`. |
| `title` | The slide's main line. **Make it the takeaway, not a topic label** ("Onboarding drops 40% at step 3", not "Onboarding"). |
| `subtitle` | Cover/secondary line. |
| `body` | ONE short supporting sentence. Keep on-slide text minimal — the narration carries detail. |
| `bullets` | Use sparingly (≤5). Prefer `cards`/visuals. |
| `cards` | For `features`/team: 2–3 `{ icon?, heading, text? }`. |
| `stat` | For `results`: `{ value, label }` (big number). |
| `quote` | `{ text, attribution }`. |
| `visual` | `{ type: "image"|"mermaid"|"none", src?, code?, alt? }`. |
| `cta` | On a `cta` slide: the button/step label. |
| `narration` | Spoken script for this slide (see `narration-rules.md`). Also exported as speaker notes. |
| `notes` | Optional presenter notes (used if `narration` absent). |

## Layout cheat-sheet (auto-derived from `type`)
- `cover → title`, `problem/users/insight → statement`, `solution → split` (needs a visual, else statement), `how → diagram` (needs a visual, else list/statement), `features/team → cards`, `results → stat` (needs `stat`, else statement), `next/appendix → list`, `cta → closing`.
- If a layout needs data it doesn't have, it gracefully downgrades.

## Visuals
- **Image:** `{ "type":"image", "src":"./shot.png", "alt":"..." }`. Paths are
  relative to where `deck.html` is written; copy assets next to it. Self-contained.
- **Mermaid:** `{ "type":"mermaid", "code":"flowchart LR\n A-->B" }`. Great for
  "How it works". Renders at view time via CDN (needs network); use an image for
  fully-offline decks.

## Showcasing the live product
If you captured the running UI with `capture_demo.mjs` (see
`references/demo-capture.md`), put the screenshots on slides so viewers see the
actual product. The **`showcase`** layout frames one screenshot large:
```json
{ "type": "features", "layout": "showcase",
  "title": "HatchLab — an AI idea graph.",
  "visual": { "type": "image", "src": "demo/shots/04-hatchlab.png", "alt": "HatchLab" },
  "body": "Start with a challenge, converge on one buildable idea.",
  "narration": "And this is HatchLab, where you hatch your idea on an AI idea graph." }
```
`split` (image beside text) and `diagram` (centered image) also accept image
visuals. Keep the deck and captures in the same `build/<name>/` folder so the
relative `src` resolves for both viewing and the video render.

## Word highlighting (how it's wired)
`render_deck.mjs` wraps each word of `title/subtitle/body/bullets/cards/stat
label/quote` in `<span class="w" data-w="N">`. The indices are contiguous and
mirrored in `deck.words.json`. Don't author the spans yourself — just write plain
text; the renderer handles it. The Phase 3/4 narration pipeline maps spoken words
onto these spans.

## Good defaults
- 10–12 slides. One idea per slide. Title = takeaway.
- Convert "list of features" into `cards`, not `bullets`.
- Put the real explanation in `narration`, not on the slide.
