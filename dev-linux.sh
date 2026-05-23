#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env"
  set +a
fi

export WEBKIT_DISABLE_DMABUF_RENDERER=1
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export GDK_APPLICATION_NAME="dev.smoke.app"
export GTK_TITLE="Smoke"
export GTK_USE_PORTAL=1

DEV_PORT="${SMOKE_DEV_PORT:-1420}"

kill_port() {
  local port="$1"
  local killed=false

  if command -v fuser >/dev/null 2>&1; then
    if fuser "${port}/tcp" >/dev/null 2>&1; then
      fuser -k "${port}/tcp" 2>/dev/null || true
      killed=true
    fi
  fi

  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti:"${port}" 2>/dev/null || true)
    if [[ -n "${pids}" ]]; then
      kill -9 ${pids} 2>/dev/null || true
      killed=true
    fi
  fi

  if [[ "${killed}" == true ]]; then
    sleep 0.5
  fi
}

port_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -tln | grep -q ":${DEV_PORT} "
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"${DEV_PORT}" >/dev/null 2>&1
    return $?
  fi
  return 1
}

kill_port "${DEV_PORT}"
if port_in_use; then
  kill_port "${DEV_PORT}"
fi
if port_in_use; then
  echo "Port ${DEV_PORT} is still in use."
  exit 1
fi

export PORT="${DEV_PORT}"
npx tauri dev
