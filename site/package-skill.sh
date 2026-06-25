#!/usr/bin/env bash
# package-skill.sh — bundle the deck-to-video skill into site/deck-to-video.tar.gz
# for hosting (VibeHub / any static host). Excludes node_modules, build, .venv.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="pitch"
OUT="$ROOT/site/$NAME.tar.gz"

if [ ! -d "$ROOT/$NAME" ]; then
  echo "error: $ROOT/$NAME not found" >&2; exit 1
fi

tar \
  --exclude="$NAME/node_modules" \
  --exclude="$NAME/build" \
  --exclude="$NAME/.venv" \
  --exclude='.DS_Store' \
  -czf "$OUT" -C "$ROOT" "$NAME"

echo "✓ wrote $OUT ($(du -h "$OUT" | cut -f1))"
echo "  contents:"
tar -tzf "$OUT" | head -20
