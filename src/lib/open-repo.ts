/** Add / open a local folder that is already a Git repository. */

export async function isGitRepository(path: string): Promise<boolean> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("is_git_repo", { path: path.trim() });
}

export async function pickRepositoryFolder(title = "Add existing repository"): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title,
  });
  if (selected == null) return null;
  return typeof selected === "string" ? selected : null;
}

export type AddRepoResult =
  | { ok: true; path: string; name: string }
  | { ok: false; error: string };

export async function addExistingRepository(folderPath: string): Promise<AddRepoResult> {
  const path = folderPath.trim();
  if (!path) {
    return { ok: false, error: "No folder selected." };
  }

  try {
    const isRepo = await isGitRepository(path);
    if (!isRepo) {
      return {
        ok: false,
        error:
          "This folder is not a Git repository. Choose a folder that contains a .git directory, or use Create new repository.",
      };
    }

    const name = path.split("/").filter(Boolean).pop() || path;
    return { ok: true, path, name };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read that folder.",
    };
  }
}

export function removeRecentRepository(path: string): void {
  try {
    const stored = localStorage.getItem("smoke_recent_repos");
    const list: { path: string; name: string }[] = stored ? JSON.parse(stored) : [];
    const updated = list.filter((r) => r.path !== path);
    localStorage.setItem("smoke_recent_repos", JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}

export function saveRecentRepository(path: string, name: string): void {
  try {
    const stored = localStorage.getItem("smoke_recent_repos");
    const list: { path: string; name: string }[] = stored ? JSON.parse(stored) : [];
    const updated = [{ path, name }, ...list.filter((r) => r.path !== path)].slice(0, 20);
    localStorage.setItem("smoke_recent_repos", JSON.stringify(updated));
  } catch {
    localStorage.setItem("smoke_recent_repos", JSON.stringify([{ path, name }]));
  }
}

export async function pickAndAddExistingRepository(): Promise<AddRepoResult> {
  const picked = await pickRepositoryFolder();
  if (!picked) {
    return { ok: false, error: "" };
  }
  return addExistingRepository(picked);
}
