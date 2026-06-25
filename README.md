# Pitch

An **Agent Skill** that turns any project into a **brand-styled deck** and an
**AI-narrated explainer video** — with a **live demo of the actual UI**. Built for
designers and "vibecoders" who want a polished explainer without a timeline editor.

## Install
```bash
curl -fsSL https://github.com/aadithva/pitch/releases/latest/download/install.sh | bash
```
Installs the skill to `~/.claude/skills/pitch` and the slash commands to
`~/.claude/commands` (override with `SKILLS_DIR` / `COMMANDS_DIR`).

## Pick a variant (slash commands)
| Command | Output |
|---------|--------|
| `/pitch` | **Full** — live demo + deck + narrated video |
| `/pitch-deck` | **Deck only** (HTML + PDF) |
| `/pitch-video` | **Deck + AI voiceover** → narrated MP4 |
| `/pitch-script` | **Script only** — the spoken narration / talk-track |
| `/pitch-demo` | **Live UI demo** — runs the app, captures screenshots + a recording |

Open your agent in any project and run one of these.

## How it works (five layers)
1. **Extract style** — reads the project's real colors, fonts, and logo into an
   on-brand theme (design tokens, CSS vars, Tailwind/shadcn, `next/font`).
2. **Live demo** — runs the actual app (or a `--url`) and records the real UI + flow.
3. **Generate deck** — writes a self-explanatory deck and renders themed reveal.js.
4. **Narrate** — writes & speaks a script with AI voice (edge-tts), free and local.
5. **Render video** — captures the deck deterministically and muxes the voiceover
   into an MP4. Subtitles and on-slide highlighting are opt-in.

## Requirements
- **Node 20+**, **ffmpeg**, **Chromium** (installed by the script)
- **Python 3** for the AI voiceover (`edge-tts`)

## Manual install (no script)
```bash
git clone https://github.com/aadithva/pitch && cp -r pitch/pitch ~/.claude/skills/pitch
cp pitch/pitch/commands/*.md ~/.claude/commands/
cd ~/.claude/skills/pitch && npm install && npx playwright install chromium
python3 -m venv .venv && ./.venv/bin/pip install edge-tts   # optional, for voiceover
```

## Repo layout
```
pitch/    the skill (SKILL.md, scripts, assets, schemas, references, commands)
site/     the install landing page + install.sh + package-skill.sh
```

## License
MIT.
