#!/usr/bin/env bash
# install.sh — install the deck-to-video Agent Skill into your skills directory.
#
#   curl -fsSL https://vibehub.microsoft.com/app/deck-to-video/install.sh | bash
#
# Overrides (env vars):
#   SKILLS_DIR              where to install   (default: ~/.claude/skills)
#   DECK_TO_VIDEO_BASE_URL  where to fetch from (default: the VibeHub app URL)
set -euo pipefail

NAME="deck-to-video"
BASE_URL="${DECK_TO_VIDEO_BASE_URL:-https://vibehub.microsoft.com/app/deck-to-video}"
SKILLS_DIR="${SKILLS_DIR:-$HOME/.claude/skills}"
DEST="$SKILLS_DIR/$NAME"

say() { printf '\033[36m▸\033[0m %s\n' "$1"; }
ok()  { printf '\033[32m✓\033[0m %s\n' "$1"; }

say "Installing '$NAME' → $DEST"
mkdir -p "$SKILLS_DIR"

if [ -d "$DEST" ]; then
  say "existing install found — backing up to $DEST.bak"
  rm -rf "$DEST.bak"; mv "$DEST" "$DEST.bak"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
say "Downloading skill from $BASE_URL …"
curl -fsSL "$BASE_URL/$NAME.tar.gz" -o "$tmp/$NAME.tar.gz"
tar -xzf "$tmp/$NAME.tar.gz" -C "$SKILLS_DIR"
ok "skill files installed"

if command -v npm >/dev/null 2>&1; then
  say "Installing Node dependencies (reveal.js, node-vibrant, playwright) …"
  ( cd "$DEST" && npm install --silent && npx --yes playwright install chromium )
  ok "Node dependencies installed"
else
  say "npm not found — install Node 20+ then run: (cd \"$DEST\" && npm install && npx playwright install chromium)"
fi

cat <<EOF

$(ok "Installed '$NAME'.")

Optional (AI voiceover via edge-tts):
  python3 -m venv "$DEST/.venv" && "$DEST/.venv/bin/pip" install edge-tts

Requirements: Node 20+, ffmpeg, Chromium (installed above). Python 3 for TTS.

Next: open your agent in any project and ask it to
  "turn this project into a deck and a narrated video".
EOF
