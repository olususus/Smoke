#!/usr/bin/env bash
# Detect a stale Smoke install (old push/auth UI strings) and basic token presence.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OLD_NEEDLE='Open Smoke from the home screen and sign in to GitHub'
NEW_NEEDLE='Smoke could not load your GitHub token'

BIN="${1:-}"
if [[ -z "$BIN" ]]; then
  BIN="$(command -v smoke 2>/dev/null || true)"
fi
if [[ -z "$BIN" && -f "$ROOT/src-tauri/target/release/smoke" ]]; then
  BIN="$ROOT/src-tauri/target/release/smoke"
fi

echo "==> Smoke install check"
if [[ -z "$BIN" || ! -f "$BIN" ]]; then
  echo "No smoke binary found. Pass path: $0 /path/to/smoke"
  exit 1
fi
echo "Binary: $BIN"
echo "Mtime:  $(stat -c '%y' "$BIN" 2>/dev/null || stat -f '%Sm' "$BIN")"

if strings "$BIN" | grep -qF "$OLD_NEEDLE"; then
  echo ""
  echo "STALE BUILD: this binary still has the old inline push error."
  echo "Rebuild and reinstall:"
  echo "  cd \"$ROOT\" && ./build-linux.sh"
  echo "  sudo dnf install \"\$ROOT/src-tauri/target/release/bundle/rpm\"/*.rpm"
  echo "  pkill -f smoke || true"
  echo "  $ROOT/src-tauri/target/release/smoke"
  exit 2
fi

if strings "$BIN" | grep -qF "$NEW_NEEDLE"; then
  echo "Push auth strings: current (token-based git HTTPS)."
else
  echo "Push auth strings: unknown (rebuild recommended)."
fi

TOKEN_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/smoke/github_token"
if [[ -f "$TOKEN_FILE" ]]; then
  echo "Token backup: present ($TOKEN_FILE)"
else
  echo "Token backup: missing — sign in from Smoke home after upgrading."
fi

echo ""
echo "OK — binary looks up to date. If push still fails, read the popup (branch protection / non-fast-forward are common on main)."
