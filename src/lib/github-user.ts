import { getStoredAuth } from "./auth";
import { githubApiFetch } from "./github-api";

export interface GitHubUser {
  login: string;
  name: string;
  avatarUrl: string;
}

export async function fetchGitHubUser(): Promise<GitHubUser | null> {
  const stored = await getStoredAuth();
  if (!stored?.has_token) return null;

  if (stored.username && stored.avatar_url) {
    return {
      login: stored.username,
      name: stored.name?.trim() || stored.username,
      avatarUrl: stored.avatar_url,
    };
  }

  try {
    const data = await githubApiFetch<{
      login?: string;
      name?: string | null;
      avatar_url?: string;
    }>("/user");
    const login = data.login ?? "";
    const avatarUrl = data.avatar_url ?? "";
    if (!login) return null;

    return {
      login,
      name: (data.name ?? "").trim() || login,
      avatarUrl,
    };
  } catch {
    return null;
  }
}
