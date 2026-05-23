const ALLOWED_PREFIXES = [
  "https://github.com/",
  "https://docs.github.com/",
  "https://www.github.com/",
] as const;

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "docs.github.com" && host !== "www.github.com") {
      return false;
    }
    const normalized = `${parsed.protocol}//${host}${parsed.pathname}${parsed.search}${parsed.hash}`;
    return ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  } catch {
    return false;
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isAllowedExternalUrl(url)) {
    throw new Error("URL is not allowed");
  }
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
