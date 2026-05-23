<img width="1280" height="320" alt="readme-banner" src="https://github.com/user-attachments/assets/c7f0affb-6b05-4a0a-a07f-006166286485" />


# Smoke

A **GitHub Desktop-style** Git client for Linux, built with **Tauri 2** and **Next.js**. Sign in with GitHub, manage local repos, stage hunks, resolve conflicts, and work with pull requests in-app, with a Frutiger Aero-inspired UI.

## Why Smoke exists

I built this because the usual **GitHub Desktop fork for Linux** was rough on my **Fedora** setup: crashes, sluggish WebKit, and missing polish for day-to-day work. Smoke targets Fedora/Nobara first: native `.rpm`, WebKit workarounds for NVIDIA, and features I actually use (PR inbox, publish branch, secret gate, and so on).

Visual system and UI rules: [`DESIGN.md`](DESIGN.md).

## Features

- **Changes / History / Pull requests**: familiar three-pane layout
- **Git**: stage & unstage (including hunks), stash, merge, rebase, squash, remotes, tags
- **GitHub**: device-flow sign-in, PR inbox, checks, merge from the app
- **Safety**: optional secret scan before commit
- **Themes**: dark, light, or follow system (App settings)
- **Extras**: command palette, co-authors, optional GPG signing
- **Background refresh**: picks up commits and file changes made outside the app (terminal, other editors)

## Development

On **Fedora / Nobara** (or other distros with WebKitGTK 4.1 dev packages):

```bash
./scripts/install-deps-fedora.sh   # once
./dev-linux.sh
```

`dev-linux.sh` applies WebKitGTK tuning env vars and runs `tauri dev` (Next.js on port **1420**). Optional: copy `.env.example` to `.env` and set `GITHUB_CLIENT_ID` for your own GitHub OAuth app.

## Production build

```bash
./scripts/install-deps-fedora.sh   # once
./build-linux.sh                   # default bundle: .rpm
sudo dnf install ./src-tauri/target/release/bundle/rpm/Smoke-*.rpm
```

Run the release binary without installing:

```bash
./scripts/run-release.sh
```

Other formats:

```bash
SMOKE_BUNDLES=deb,appimage ./build-linux.sh
```

Build output lives under `src-tauri/target/` (ignored by git).

## Version bumps

```bash
./version-change              # print current version
./version-change 0.2.0        # set exact version
./version-change patch        # 0.1.0 → 0.1.1
```

Or: `npm run version:change -- 0.2.0`

Updates `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. Does not commit or tag; run git yourself after.

## Linux: WebKit / NVIDIA crashes

If Smoke segfaults in `WebKitWebProcess` (often with NVIDIA + EGL), the app sets WebKit workarounds at startup (see `[src-tauri/src/webkit_linux.rs](src-tauri/src/webkit_linux.rs)`). Rebuild and reinstall after pulling fixes:

```bash
./build-linux.sh
sudo dnf reinstall ./src-tauri/target/release/bundle/rpm/Smoke-*.rpm
```

Software rendering fallback:

```bash
SMOKE_WEBKIT_SOFTWARE=1 ./scripts/run-release.sh
```

Optional reference launcher env vars: `[src-tauri/linux/smoke.desktop](src-tauri/linux/smoke.desktop)`.

## CI & releases


| Trigger            | Workflow                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Push to `main`     | Lint / typecheck: `[.github/workflows/ci.yml](.github/workflows/ci.yml)`                   |
| Tag `v*` or manual | `.deb`, `.rpm`, AppImage: `[.github/workflows/release.yml](.github/workflows/release.yml)` |


## Project links

- App repo: [github.com/olususus/smoke](https://github.com/olususus/smoke)
