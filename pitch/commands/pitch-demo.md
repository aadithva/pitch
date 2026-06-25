---
description: Live UI demo only — run the project's app and capture screenshots + a recording.
argument-hint: "[project path or --url] (defaults to the current directory)"
---
Use the **pitch** skill in **DEMO-ONLY** mode for the target project
(`$ARGUMENTS` if given, else the current working directory).

Run `node scripts/capture_demo.mjs <project> --out build/<name> --record true` to:
- detect + start the app (framework dev server, static site, or a live `--url`),
- auto-discover routes (or pass `--routes a,b,c`),
- capture per-route **screenshots** + a **flow recording**.

If the app is auth-gated and won't run locally, ask the user for a deployed
`--url` and capture that instead.

Deliver: `build/<name>/demo/shots/*.png` and `build/<name>/demo/demo.mp4`.
