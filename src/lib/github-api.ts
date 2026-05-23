export interface GithubApiRequest {
  method: string;
  apiPath: string;
  body?: unknown;
}

/** User-facing message from a failed GitHub API invoke. */
export function formatGithubApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("Sign in again") || raw.includes("SSO") || raw.includes("github.com/settings/tokens")) {
    return raw;
  }
  if (raw.includes("403")) {
    if (raw.toLowerCase().includes("rate limit")) {
      return `${raw}\n\nGitHub API rate limit hit. Wait a minute and try again.`;
    }
    return `${raw}\n\nTip: Sign out and sign in again so Smoke can request repo access. For org repos, authorize the token for SSO at github.com/settings/tokens.`;
  }
  if (raw.includes("401")) {
    return `${raw}\n\nSign in again from the Smoke login screen.`;
  }
  return raw;
}

export async function githubApiFetch<T = unknown>(apiPath: string): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("GitHub API is only available in the desktop app");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>("github_api_fetch", { apiPath });
}

export async function githubApiRequest<T = unknown>(
  method: string,
  apiPath: string,
  body?: unknown
): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("GitHub API is only available in the desktop app");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>("github_api_request", {
    req: { method, api_path: apiPath, body: body ?? null },
  });
}

/** Fetch all pages for a list endpoint (Link rel=next). */
export async function githubApiFetchAllPages<T>(
  apiPath: string,
  maxPages = 10
): Promise<T[]> {
  const items: T[] = [];
  let path: string | null = apiPath.includes("?")
    ? apiPath
    : `${apiPath}${apiPath.includes("?") ? "&" : "?"}per_page=100`;

  for (let page = 0; page < maxPages && path; page++) {
    const data = await githubApiFetch<T[] | { items?: T[] }>(path);
    if (Array.isArray(data)) {
      items.push(...data);
      break;
    }
    if (data && typeof data === "object" && "items" in data && Array.isArray(data.items)) {
      items.push(...data.items);
      break;
    }
    break;
  }

  return items;
}
