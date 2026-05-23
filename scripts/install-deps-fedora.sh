#!/usr/bin/env bash
# Fedora / Nobara packages required to compile and bundle Smoke (Tauri + WebKitGTK).
set -euo pipefail

if ! command -v dnf >/dev/null 2>&1; then
  echo "This script is for Fedora-derived systems (dnf)."
  exit 1
fi

echo "Installing Smoke build dependencies…"
sudo dnf install -y \
  nodejs npm \
  rust cargo \
  gcc gcc-c++ make pkg-config \
  openssl-devel \
  webkit2gtk4.1-devel \
  javascriptcoregtk4.1-devel \
  libsoup3-devel \
  librsvg2-devel \
  dbus-devel \
  glib2-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  fuse \
  rpm-build \
  patchelf \
  curl wget file

echo "Done. You can run: ./build-linux.sh"
