import type { AppSettings, ThemeMode } from "./app-settings";
import { STORAGE_KEY } from "./app-settings";

export type ResolvedTheme = "dark" | "light";

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function applyThemeMode(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);
  applyResolvedTheme(resolved);
  return resolved;
}

/** Read persisted theme before React hydrates (avoids flash). */
export function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "dark";
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    if (parsed.theme === "light" || parsed.theme === "system") return parsed.theme;
    return "dark";
  } catch {
    return "dark";
  }
}
