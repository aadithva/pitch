# Live Demo Capture

`scripts/capture_demo.mjs` runs a project's UI and captures a **live demo** — per-route
screenshots and a screen recording of a scroll/navigation flow — so the deck and video
can show the actual running product (not just words about it).

## Run it
```bash
# Auto-detect + serve the project, capture screenshots + a recording
node scripts/capture_demo.mjs <projectDir> --out build/<name> [options]

# Or capture an already-running / live site
node scripts/capture_demo.mjs --url http://localhost:3000 --out build/<name>
```

## Options
| Flag | Default | Purpose |
|------|---------|---------|
| `--url <baseUrl>` | — | Capture a live/running site (skip serving) |
| `--routes a,b,c` | auto | Explicit routes/paths to capture (relative to base) |
| `--max-routes N` | 6 | Cap auto-discovered routes |
| `--record true\|false` | true | Also record a screen-recording flow → `demo.mp4` |
| `--width/--height` | 1440×900 | Viewport |
| `--wait-selector S` | — | Wait for this CSS selector on each route before shooting |
| `--port N` | free port | Static/dev server port |

## How it detects + serves a UI
1. **Framework dev server** — if `package.json` has a known dev script and
   `node_modules` exists (astro/next/nuxt/vite/SvelteKit/CRA/gatsby), it runs the
   dev script and detects the printed `localhost:PORT`.
2. **Static site** — otherwise it serves the folder with `python3 -m http.server`
   (no extra deps) and captures the `.html` routes.
3. **Live URL** — with `--url`, it captures a running site directly.

## Output (`build/<name>/demo/`)
```
shots/NN-<route>.png        viewport screenshot per route
shots/NN-<route>-full.png   full-page screenshot per route
demo.mp4                    screen recording of the flow (if --record)
manifest.json               { baseUrl, routes, shots[], video }
```

## Use the captures in the deck
Reference a screenshot as an image visual on a `showcase` (large), `split`, or
`diagram` slide — paths are relative to where `deck.html` is written:
```json
{ "type": "features", "layout": "showcase",
  "title": "HatchLab — an AI idea graph.",
  "visual": { "type": "image", "src": "demo/shots/04-hatchlab.png" },
  "narration": "And this is HatchLab, where you hatch your idea on an AI idea graph." }
```
The `showcase` layout frames the screenshot prominently. Because the deck and the
captures live in the same `build/<name>/` folder, the relative `src` resolves for
both browser viewing and the Playwright video render.

## Splice the recording into the narrated video
Turn the standalone recording into a "live demo" section inside `final.mp4`:
```bash
node scripts/splice_demo.mjs <deckVideo.mp4> demo/demo.mp4 --out final-with-demo.mp4 \
  [--at <sec>] [--narration "Here's the product in action."] [--max-demo <sec>]
```
It normalizes the recording to the deck video's resolution/fps, gives it a short
spoken intro (via `.venv` edge-tts, optional), and concatenates. With `--at <sec>`
it splits the deck video and inserts the demo at that timestamp — pick a **slide
boundary** (the silent pad gap between slides) for a clean cut; without `--at` it
appends to the end. Requires `ffmpeg`.

## Notes & limits
- Interactive/AI features that need a backend may render only their entry/empty
  state when run locally without keys — the UI still showcases well. Use
  `--wait-selector` to wait for a specific element, or `--url` to point at a
  fully-deployed instance.
- Capture at `--width 1280 --height 720` if you want the recording to fill a
  720p video with no letterboxing when spliced.
- Requires Playwright Chromium (`npx playwright install chromium`) and `ffmpeg`
  (for the webm→mp4 conversion). Static serving uses `python3`.
