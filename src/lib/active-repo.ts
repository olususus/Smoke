const ACTIVE_REPO_KEY = "smoke_active_repo";

export function setActiveRepository(path: string): void {
  localStorage.setItem(ACTIVE_REPO_KEY, path);
}

export function getActiveRepository(): string | null {
  return localStorage.getItem(ACTIVE_REPO_KEY);
}

export function clearActiveRepository(): void {
  localStorage.removeItem(ACTIVE_REPO_KEY);
}
