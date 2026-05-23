export type MotionMode = "smooth" | "instant";

export type ThemeMode = "dark" | "light" | "system";

/** Scan staged diffs before commit for leaked secrets/tokens. */
export type CommitSafetyMode = "off" | "warn" | "block";

export const STORAGE_KEY = "smoke_app_settings";

export interface AppSettings {
  /** App color scheme */
  theme: ThemeMode;
  /** Smooth aero transitions vs instant UI */
  motion: MotionMode;
  /** Secret detection policy when committing */
  commitSafety: CommitSafetyMode;
  /** Extra regex patterns (one per line) for secret scanning */
  customSecretPatterns: string[];
  /** Command to open files in external editor, e.g. code --wait */
  externalEditor: string;
  /** History list vs neural graph */
  historyGraphMode: boolean;
  backgroundRefresh: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "dark",
  motion: "smooth",
  commitSafety: "block",
  customSecretPatterns: [],
  externalEditor: "",
  historyGraphMode: false,
  backgroundRefresh: true,
};

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const commitSafety =
      parsed.commitSafety === "off" || parsed.commitSafety === "warn"
        ? parsed.commitSafety
        : "block";
    const theme =
      parsed.theme === "light" || parsed.theme === "system" ? parsed.theme : "dark";
    return {
      theme,
      motion: parsed.motion === "instant" ? "instant" : "smooth",
      commitSafety,
      customSecretPatterns: Array.isArray(parsed.customSecretPatterns)
        ? parsed.customSecretPatterns.filter((p): p is string => typeof p === "string")
        : [],
      externalEditor: typeof parsed.externalEditor === "string" ? parsed.externalEditor : "",
      historyGraphMode: parsed.historyGraphMode === true,
      backgroundRefresh: parsed.backgroundRefresh !== false,
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function motionDurationMs(mode: MotionMode): number {
  return mode === "instant" ? 0 : 280;
}

export function motionDurationSlowMs(mode: MotionMode): number {
  return mode === "instant" ? 0 : 380;
}
