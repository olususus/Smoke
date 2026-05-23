#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${CARGO_TARGET_DIR:-$ROOT/src-tauri/target}/release/smoke"

export WEBKIT_DISABLE_DMABUF_RENDERER="${WEBKIT_DISABLE_DMABUF_RENDERER:-1}"
export WEBKIT_DISABLE_COMPOSITING_MODE="${WEBKIT_DISABLE_COMPOSITING_MODE:-1}"
export GTK_USE_PORTAL="${GTK_USE_PORTAL:-1}"

if [[ ! -x "$BIN" ]]; then
  echo "Release binary not found. Run ./build-linux.sh first."
  exit 1
fi

exec "$BIN" "$@"
