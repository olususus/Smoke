export function isTauriApp(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  );
}

export async function confirmApp(
  text: string,
  options?: { title?: string; kind?: "info" | "warning" | "error" }
): Promise<boolean> {
  if (isTauriApp()) {
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    return confirm(text, {
      title: options?.title ?? "Smoke",
      kind: options?.kind ?? "warning",
    });
  }
  return window.confirm(text);
}

export async function messageApp(
  text: string,
  options?: { title?: string; kind?: "info" | "warning" | "error" }
): Promise<void> {
  if (isTauriApp()) {
    const { message } = await import("@tauri-apps/plugin-dialog");
    await message(text, {
      title: options?.title ?? "Smoke",
      kind: options?.kind ?? "info",
    });
    return;
  }
  window.alert(text);
}
