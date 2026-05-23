#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env"
  set +a
fi

export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/src-tauri/target}"
export WEBKIT_DISABLE_DMABUF_RENDERER="${WEBKIT_DISABLE_DMABUF_RENDERER:-1}"
export WEBKIT_DISABLE_COMPOSITING_MODE="${WEBKIT_DISABLE_COMPOSITING_MODE:-1}"

BUNDLES="${SMOKE_BUNDLES:-rpm}"

echo "==> Smoke production build (bundles: ${BUNDLES})"

if ! command -v npm >/dev/null; then
  echo "npm not found. On Fedora: sudo dnf install nodejs npm"
  exit 1
fi
if ! command -v cargo >/dev/null; then
  echo "cargo not found. On Fedora: sudo dnf install rust cargo"
  exit 1
fi
if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
  echo "webkit2gtk-4.1 not found. Run: ./scripts/install-deps-fedora.sh"
  exit 1
fi

npm ci

export NEXT_PUBLIC_SMOKE_RELEASE=1
npm run tauri build -- --bundles "${BUNDLES}"

BUNDLE_DIR="$CARGO_TARGET_DIR/release/bundle"
echo ""
echo "Artifacts:"
find "$BUNDLE_DIR" -type f \( -name '*.rpm' -o -name '*.deb' -o -name '*.AppImage' \) 2>/dev/null | sort || true

RPM="$(find "$BUNDLE_DIR/rpm" -name '*.rpm' 2>/dev/null | head -1)"
if [[ -n "${RPM}" ]]; then
  echo ""
  echo "Install: sudo dnf install \"${RPM}\""
  echo "Run:     $CARGO_TARGET_DIR/release/smoke"
fi
