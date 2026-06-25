#!/usr/bin/env bash
# install.sh — install the Pitch Agent Skill + its slash commands.
#
#   curl -fsSL https://github.com/aadithva/pitch/releases/latest/download/install.sh | bash
#
# Overrides (env vars):
#   SKILLS_DIR     where the skill goes     (default: ~/.claude/skills)
#   COMMANDS_DIR   where commands go        (default: ~/.claude/commands)
#   PITCH_BASE_URL where to fetch from      (default: the GitHub Release URL)
set -euo pipefail

NAME="pitch"
BASE_URL="${PITCH_BASE_URL:-https://github.com/aadithva/pitch/releases/latest/download}"
SKILLS_DIR="${SKILLS_DIR:-$HOME/.claude/skills}"
COMMANDS_DIR="${COMMANDS_DIR:-$HOME/.claude/commands}"
DEST="$SKILLS_DIR/$NAME"

say() { printf '\033[36m▸\033[0m %s\n' "$1"; }
ok()  { printf '\033[32m✓\033[0m %s\n' "$1"; }

say "Installing '$NAME' → $DEST"
mkdir -p "$SKILLS_DIR"
if [ -d "$DEST" ]; then
  say "existing install found — backing up to $DEST.bak"
  rm -rf "$DEST.bak"; mv "$DEST" "$DEST.bak"
fi

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
say "Downloading skill from $BASE_URL …"
curl -fsSL "$BASE_URL/$NAME.tar.gz" -o "$tmp/$NAME.tar.gz"
tar -xzf "$tmp/$NAME.tar.gz" -C "$SKILLS_DIR"
ok "skill files installed"

# Slash commands → so /pitch, /pitch-deck, … show up in the slash menu.
if [ -d "$DEST/commands" ]; then
  mkdir -p "$COMMANDS_DIR"
  cp "$DEST"/commands/*.md "$COMMANDS_DIR"/
  ok "slash commands installed: /pitch  /pitch-deck  /pitch-script  /pitch-video  /pitch-demo"
fi

if command -v npm >/dev/null 2>&1; then
  say "Installing Node dependencies (reveal.js, node-vibrant, culori, playwright) …"
  ( cd "$DEST" && npm install --silent && npx --yes playwright install chromium )
  ok "Node dependencies installed"
else
  say "npm not found — install Node 20+ then: (cd \"$DEST\" && npm install && npx playwright install chromium)"
fi

cat <<EOF

$(ok "Installed '$NAME'.")

Optional (AI voiceover via edge-tts):
  python3 -m venv "$DEST/.venv" && "$DEST/.venv/bin/pip" install edge-tts

Requirements: Node 20+, ffmpeg, Chromium (installed above). Python 3 for TTS.

Try it: open your agent in any project and run
  /pitch            (full)        /pitch-deck   (deck only)
  /pitch-video      (deck+video)  /pitch-script (script only)   /pitch-demo (live UI)
EOF
