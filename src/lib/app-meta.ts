export const APP_NAME = "Smoke";
export const APP_CREATOR = "Sprawdzany";
export const APP_REPO_URL = "https://github.com/olususus/smoke";
export const APP_ISSUES_URL = `${APP_REPO_URL}/issues`;
export const APP_VERSION_FALLBACK = "0.0.1";

export async function getAppVersion(): Promise<string> {
  if (typeof window === "undefined") return APP_VERSION_FALLBACK;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return APP_VERSION_FALLBACK;
  }
}
