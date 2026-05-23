# Smoke — Design system

Smoke is a **GitHub Desktop–style** Git client for Linux, built with **Tauri + Next.js**. The visual language is **Frutiger Aero on black**: soft glass panels, aqua gradients, floating color blobs, and a calm dark workspace—distinct from flat Material or pure GitHub.com chrome.

This document captures intentional design choices so new UI stays consistent. Implementation lives primarily in [`src/app/globals.css`](src/app/globals.css) and shared components under [`src/app/components/`](src/app/components/).

---

## Design principles

1. **Familiar structure, expressive skin** — Three-pane repo layout (changes / history, file list, diff) follows GitHub Desktop ergonomics; color, glass, and motion carry Smoke’s identity.
2. **Dark-first, low glare** — Base `#050505` with tinted neutrals; no pure `#000` / `#fff` in the token set.
3. **Glass over flat boxes** — Panels use translucent fills, blur, and inset highlights instead of solid gray cards.
4. **Aqua = action & focus** — Primary accent `#6ec8e8` (`--aero-sky`) for links, selection, tabs, and primary buttons.
5. **Security is visible** — Secret findings use danger styling and dedicated banners/dialogs; commit safety gate is a first-class setting.
6. **Motion with an off switch** — Smooth transitions default on; **Instant** mode and `prefers-reduced-motion` respect accessibility ([`SettingsContext`](src/app/context/SettingsContext.tsx)).

---

## Typography

### Font families

| Role | Family | Source | CSS variable |
|------|--------|--------|----------------|
| **UI / prose** | [Inter](https://fonts.google.com/specimen/Inter) | `next/font/google` in [`layout.tsx`](src/app/layout.tsx) | `--font-inter` |
| **Code / paths / hashes / diffs** | [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | `next/font/google` | `--font-jetbrains` |

**Weights loaded**

- Inter: 300, 400, 500, 600, 700  
- JetBrains Mono: 400, 500, 600  

**Usage rules**

- Body default: **13px** Inter, antialiased (`html.neural-root`).
- Headlines (login, boot wordmark, welcome): **300** weight, tight negative letter-spacing (`-0.02em` to `-0.04em`) for a light, airy feel.
- File paths, commit hashes, diff lines, device codes, menu shortcuts: **JetBrains Mono**.
- Section labels (e.g. staging groups): **11px**, uppercase, `letter-spacing: 0.06em`.

### Type scale (common)

| Element | Size | Weight |
|---------|------|--------|
| Boot wordmark | `clamp(36px, 8vw, 52px)` | 300 |
| Login title | `clamp(24px, 4vw, 30px)` | 300 |
| Toolbar branch/repo name | 13px | 600 |
| Sidebar tabs | 12px | 500 |
| Commit row summary | 13px | 500 |
| Diff body | 12px | 400 (mono) |
| Tertiary meta | 11px | 400 |

---

## Color system

All tokens are defined in `:root` in [`globals.css`](src/app/globals.css). Prefer **CSS variables** over hard-coded hex in components.

### Surfaces

| Token | Value | Use |
|-------|-------|-----|
| `--bg-black` | `#050505` | App background, boot screen |
| `--bg-elevated` | `#0c0c0e` | Title bar, subtle elevation |
| `--gh-bg` | → `--bg-black` | Main panels |
| `--gh-bg-subtle` | → `--bg-elevated` | Toolbars, commit box, inputs |
| `--gh-panel` | `rgba(14, 14, 16, 0.92)` | Diff headers, modals |
| `--gh-panel-muted` | `rgba(22, 22, 26, 0.95)` | Hunk headers, avatars fallback |

### Glass

| Token | Use |
|-------|-----|
| `--glass-bg` | `rgba(255,255,255,0.05)` panel fill |
| `--glass-border` | `rgba(255,255,255,0.1)` borders |
| `--glass-highlight` | Inset top edge on glass |
| `--glass-blur` | `24px` backdrop blur |
| `--shadow-glass` | Depth + inset highlight |

### Text

| Token | Hex | Use |
|-------|-----|-----|
| `--text-primary` | `#f2f2f4` | Body, titles |
| `--text-secondary` | `#9a9aa3` | Descriptions, meta |
| `--text-tertiary` | `#5c5c66` | Placeholders, hints |
| `--text-link` | `#6ec8e8` | Links (matches accent) |

### Aero accent palette

| Token | Hex | Use |
|-------|-----|-----|
| `--aero-sky` | `#6ec8e8` | Primary accent, tab underline, icons |
| `--aero-cyan` | `#5eead4` | Gradient stops |
| `--aero-blue` | `#4a9fd4` | Gradient stops |
| `--aero-green` | `#86efac` | Success accents |

**Gradient primary button** (`--gradient-aero`): vertical gloss + sky-to-deep-blue fill. Text on buttons: `#0a1620` (dark navy) for contrast.

**Gradient text** (`--gradient-aero-text`): `.text-aero-accent` / brand row — clipped gradient for “Smoke” highlights.

### Semantic

| Token | Use |
|-------|-----|
| `--success` / `--aero-green` | Clean state, added files, staged |
| `--warning` | Modified files, behind remote |
| `--danger` | Conflicts, secrets, errors |
| `--diff-add-*` / `--diff-del-*` | Diff line backgrounds and text |

### GitHub Desktop compatibility accents

Legacy GHD blues/greens used where the **commit graph** and ref badges align with user expectations:

- `--ghd-blue` `#2188ff` — HEAD node, selected commit lane  
- `--ghd-green` `#3fb950` — Local branch badges  
- `--gh-history-line` `#484f58` — Graph edges  

### Neural graph colors (optional viz)

`--neural-1` … `--neural-6` — reserved for [`NeuralGraph`](src/app/components/NeuralGraph.tsx) lane coloring.

---

## Motion

| Token | Default | Instant mode |
|-------|---------|----------------|
| `--motion-duration-fast` | 0.18s | 0s |
| `--motion-duration` | 0.28s | 0s |
| `--motion-duration-slow` | 0.38s | 0s |
| `--motion-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | — |

**Easing philosophy:** ease-out “soft landing” curves; no bouncy springs in core UI.

**Animated surfaces**

- Tab panels ([`AnimatedTabPanels`](src/app/components/AnimatedTabPanels.tsx)): fade + slight `translateY` + scale  
- Dropdowns / modals: backdrop blur fade, modal scale  
- Boot exit: **600ms** opacity fade  

**User control:** `html[data-motion="instant"]` disables transitions on tabs, dropdowns, and modals. Setting: **App settings → Interface motion**.

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` collapses durations when smooth mode is on.

---

## Splash / boot screen

**Components:** [`SmokeBootScreen`](src/app/components/SmokeBootScreen.tsx) inside [`AppGate`](src/app/components/AppGate.tsx).

### Purpose

Brand moment on cold start while auth is checked and routes resolve. Minimum display **~2.2s** (`MIN_BOOT_MS`) so the animation does not flash.

### Layers (back → front)

1. **Black base** — `var(--bg-black)` full viewport, `z-index: 2147483646`.
2. **Neural backdrop** — [`NeuralBackdrop`](src/app/components/NeuralBackdrop.tsx) `variant="full"` (four blurred blobs, slow float).
3. **Smoke canvas** — 24 radial-gradient “wisps” drifting upward (`requestAnimationFrame`), low opacity grays/blues.
4. **Content** — Wordmark, status line, indeterminate shimmer bar.

### Copy flow

| Phase | Example status |
|-------|----------------|
| Start | “Lighting up…” |
| Auth | “Checking if you're signed in…” |
| Done | “Welcome back” / “Almost there…” |

### Wordmark

- Text: **“Smoke”** (product name, not “GitHub Desktop”).
- Style: light weight (300), large clamp size, subtle aqua text-shadow glow.

### Progress bar

- Track: `rgba(255,255,255,0.08)`  
- Fill: aqua gradient shimmer (`boot-shimmer` keyframes), **indeterminate** (not tied to real load %).

### Exit

- Class `smoke-boot--exit`: 600ms opacity fade; main app unhidden via `app-gate-content--hidden` removed.

### SSR note

First paint renders **children only** (no splash) until client `mounted` to avoid hydration mismatch.

---

## Ambient background

**Global:** `.aero-ambient` fixed layer on `<body>` in [`layout.tsx`](src/app/layout.tsx) — solid black behind all routes.

**Local:** `NeuralBackdrop` on login, dashboard welcome pane, boot screen.

**Blob animation:** `blob-float` 16–22s loops, `filter: blur(80px)`, purple-blue-gray radial gradients at low opacity.

**Variants**

- `full` — default opacity  
- `subtle` — reduced opacity for less busy areas  

---

## Layout & app shell

### Desktop window

- **Frameless window** in Tauri (`decorations: false`); custom **32px** menu bar [`.window-chrome`](src/app/globals.css) with File / Repository / Branch / View / Help.
- Drag the window from the menu bar spacer (and any non-interactive chrome area) via `data-tauri-drag-region` + `-webkit-app-region: drag`. Minimize / maximize / close: [`WindowControls`](src/app/components/WindowControls.tsx) on the right.

### Repo view (`/repo`)

```
┌─────────────────────────────────────────────┐
│ window-chrome (menus)                        │
├─────────────────────────────────────────────┤
│ gh-toolbar (repo, branch, fetch/pull/push)   │
├──────────────┬──────────────────────────────┤
│ gh-sidebar   │ gh-diff-pane (or conflict)   │
│ Changes /    │                              │
│ History      │                              │
│ + commit box │                              │
└──────────────┴──────────────────────────────┘
```

- Sidebar max-width **380px**, ~36% flex; history includes filter + [`CommitHistoryList`](src/app/components/CommitHistoryList.tsx).
- **Clean working tree:** [`ChangesCleanState`](src/app/components/ChangesCleanState.tsx) in sidebar (compact) and main pane (expanded); commit box hidden when clean.

### Dashboard (`/dashboard`)

- Split: **repo list pane** (glass, max 420px) + **welcome** (`neural-welcome`) with CTA `btn-aero`.

### Login (`/`)

- Full viewport `login-screen` + glass `login-card` centered over backdrop.

---

## Components

### Buttons

| Class | Use |
|-------|-----|
| `.btn-aero` / `.login-github-btn` | Primary CTA (gradient, dark text) |
| `.gh-commit-btn` | Commit to branch |
| `.gh-clean-state__btn--primary` | Push in clean state |
| `.btn` / `.btn-primary` / `.btn-ghost` | Modals, secondary actions |

Hover: slight `translateY(-1px)` + brightness on primary; ghost stays flat.

### Glass panel

`.glass-panel` — reusable blur panel; login card extends this pattern.

### Menus

- [`MenuDropdownItem`](src/app/components/MenuDropdownItem.tsx): label + right-aligned shortcut (mono, tertiary).
- [`DropdownPortal`](src/app/components/DropdownPortal.tsx): anchored overlays with backdrop blur.

### Modals (Aero family)

Shared pattern: `.aero-modal-backdrop` + `.aero-modal`

- [`AppSettingsDialog`](src/app/components/AppSettingsDialog.tsx) — motion + commit safety  
- [`SecretsDialog`](src/app/components/SecretsDialog.tsx) — danger header icon  
- [`KeyboardShortcutsDialog`](src/app/components/KeyboardShortcutsDialog.tsx)  
- [`AboutDialog`](src/app/components/AboutDialog.tsx)  
- [`CloneRepositoryDialog`](src/app/components/CloneRepositoryDialog.tsx)  

### Empty states

| Class | Use |
|-------|-----|
| `.gh-empty-state` | Generic centered message (history, diff fallbacks) |
| `.gh-clean-state` | Rich “working tree clean” UX |
| `.ghd-list-empty` | Dashboard repo list |

Do **not** overload `.gh-empty-state` for product moments; use `.gh-clean-state` for clean repo.

### Commit history

- Left **lane** SVG graph (GitHub-style), nodes blue when HEAD/selected.
- Rows: avatar, summary, ref badges (head / branch / remote colors), meta line.

### Diff viewer

- File header: mono path, status dot.
- Lines: green add / red delete borders; secrets get mask + reveal toggle + highlight pulse.
- Commit header block when viewing history diff.

### Status dots (files)

| Class | Meaning |
|-------|---------|
| `.gh-status-dot--added` | New / untracked |
| `.gh-status-dot--modified` | Modified |
| `.gh-status-dot--deleted` | Deleted / conflict emphasis |

### Secret / safety UI

- Banner: `.gh-commit-safety-banner` (block vs warn tint).
- Diff: `.diff-line--secret`, `.animate-secret-pulse` on staging panel.
- Settings: **Commit safety gate** Off | Warn | Block (default Block).

---

## Icons

**Library:** [Lucide React](https://lucide.dev/) — consistent 12–18px stroke icons in toolbar, menus, and empty states.

**Semantic colors**

- Success / clean: green check (`CheckCircle2`)  
- Sync: `RefreshCw`, `ArrowUp` / `ArrowDown`  
- Danger: `AlertTriangle`  
- Brand accent: `var(--aero-sky)` on settings/about icons  

---

## Spacing & radius

| Token | Value |
|-------|-------|
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 16px |
| `--radius-pill` | 14px |

**Density:** Git-focused UI stays compact (6–12px padding on rows, 32px toolbar height).

---

## Scrollbars & focus

- Custom webkit scrollbar: aqua thumb at 20% opacity.  
- `::selection`: aqua tint.  
- `:focus-visible`: 2px `--accent` outline.

---

## Product copy & naming

| Item | Value |
|------|--------|
| App name | **Smoke** |
| Window title | Smoke |
| Bundle id | `dev.smoke.app` |
| Tagline (about) | “A Git client for Linux with secret-aware commits.” |
| Auth screen | “Sign in to Smoke” |

Avoid calling the app “GitHub Desktop” in UI strings; GHD docs are linked only as **external** user guides.

---

## Anti-patterns

- Pure white/black text or backgrounds.  
- Flat opaque gray cards without glass border/blur on marketing or welcome surfaces.  
- Bright saturated fills on large areas (aero is **restrained**; blobs are low opacity).  
- Showing the commit textarea when there is nothing to commit.  
- Generic one-line empty states where contextual actions (fetch, history, last commit) belong.  
- Ignoring `data-motion` / reduced motion for decorative animations.

---

## Extending the system

1. Add tokens to `:root` in `globals.css` before using one-off hex values.  
2. Reuse `.glass-panel`, `.btn-aero`, `.aero-modal`, `.gh-dropdown-item--with-shortcut`.  
3. Mono font for anything copied from git output.  
4. New repo-level flows should hook into `AppMenubar` + shortcuts in [`menu-shortcuts.ts`](src/lib/menu-shortcuts.ts).  
5. For major new surfaces, consider a short addition to this file.

---

## File map

| Concern | Location |
|---------|----------|
| Design tokens & global styles | [`src/app/globals.css`](src/app/globals.css) |
| Fonts | [`src/app/layout.tsx`](src/app/layout.tsx) |
| Boot / splash | [`SmokeBootScreen.tsx`](src/app/components/SmokeBootScreen.tsx), [`AppGate.tsx`](src/app/components/AppGate.tsx) |
| Backdrop blobs | [`NeuralBackdrop.tsx`](src/app/components/NeuralBackdrop.tsx) |
| Motion setting | [`src/lib/app-settings.ts`](src/lib/app-settings.ts), [`SettingsContext.tsx`](src/app/context/SettingsContext.tsx) |
| App metadata | [`src/lib/app-meta.ts`](src/lib/app-meta.ts) |
| Repo shell | [`src/app/repo/page.tsx`](src/app/repo/page.tsx) |
| Menus | [`AppMenubar.tsx`](src/app/components/AppMenubar.tsx) |

---

*Last updated to reflect the Frutiger Aero dark theme, Inter + JetBrains Mono pairing, Smoke boot screen, clean-state UI, and commit safety gate.*
