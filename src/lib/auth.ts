export interface PublicAuth {
  username: string;
  name?: string;
  avatar_url: string;
  has_token: boolean;
}

export async function getStoredAuth(): Promise<PublicAuth | null> {
  try {
    if (
      typeof window !== "undefined" &&
      (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    ) {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<PublicAuth | null>("auth_check_stored");
    }
  } catch {
    return null;
  }
  return null;
}

export async function isSignedIn(): Promise<boolean> {
  const auth = await getStoredAuth();
  return Boolean(auth?.has_token);
}

export async function clearAuth(): Promise<void> {
  try {
    if (
      typeof window !== "undefined" &&
      (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    ) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("auth_sign_out");
    }
  } catch {
    /* ignore */
  }
}
