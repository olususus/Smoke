/** True for static Tauri bundles (not `tauri dev`). Set in tauri.conf beforeBuildCommand. */
export function isReleaseBuild(): boolean {
  return process.env.NEXT_PUBLIC_SMOKE_RELEASE === "1";
}

export function isTauriApp(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

/** Apply Linux WebKit tuning + lighter GPU effects for release builds. */
export function applyReleaseRuntimeTuning(): void {
  if (typeof document === "undefined" || !isReleaseBuild()) return;
  document.documentElement.dataset.effects = "lite";
}
