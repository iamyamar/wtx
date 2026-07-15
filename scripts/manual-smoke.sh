#!/usr/bin/env bash
set -euo pipefail

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
REPO="$ROOT/repo"
REGISTRY="$ROOT/registry"
CLI="$(cd "$(dirname "$0")/.." && pwd)/dist/cli.js"

mkdir -p "$REPO"
git -C "$REPO" init -b main --quiet
git -C "$REPO" config user.name "WTX smoke test"
git -C "$REPO" config user.email "wtx@example.test"
printf 'smoke test\n' > "$REPO/README.md"
git -C "$REPO" add README.md
git -C "$REPO" commit -m initial --quiet

export WTX_HOME="$REGISTRY"
cd "$REPO"
node "$CLI" create feature/smoke --no-shell --no-port
node "$CLI" status feature/smoke
node "$CLI" list
node "$CLI" destroy feature/smoke
echo "Smoke test passed."
