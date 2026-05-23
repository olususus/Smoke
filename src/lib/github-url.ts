/** Parse owner/repo from a GitHub HTTPS or git@ remote URL. */
export function parseGitHubRemote(remoteUrl: string | null | undefined): {
  owner: string;
  repo: string;
  webBase: string;
} | null {
  if (!remoteUrl?.trim()) return null;
  let url = remoteUrl.trim();
  if (url.startsWith("git@github.com:")) {
    const path = url.slice("git@github.com:".length).replace(/\.git$/, "");
    const [owner, repo] = path.split("/");
    if (!owner || !repo) return null;
    return { owner, repo, webBase: `https://github.com/${owner}/${repo}` };
  }
  try {
    const parsed = new URL(url.replace(/\.git$/, ""));
    if (!parsed.hostname.includes("github.com")) return null;
    const parts = parsed.pathname.replace(/^\//, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return {
      owner: parts[0],
      repo: parts[1],
      webBase: `https://github.com/${parts[0]}/${parts[1]}`,
    };
  } catch {
    return null;
  }
}

export function githubBranchUrl(remoteUrl: string | null, branch: string): string | null {
  const gh = parseGitHubRemote(remoteUrl);
  if (!gh || !branch) return null;
  return `${gh.webBase}/tree/${encodeURIComponent(branch)}`;
}

export function githubCompareUrl(
  remoteUrl: string | null,
  base: string,
  head: string
): string | null {
  const gh = parseGitHubRemote(remoteUrl);
  if (!gh) return null;
  return `${gh.webBase}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
}

export function githubCreatePrUrl(
  remoteUrl: string | null,
  base: string,
  head: string
): string | null {
  const compare = githubCompareUrl(remoteUrl, base, head);
  if (!compare) return null;
  return `${compare}?expand=1`;
}

export function githubIssuesUrl(): string {
  return "https://github.com/olususus/smoke/issues/new";
}

export function githubCommitUrl(remoteUrl: string | null, commitHash: string): string | null {
  const gh = parseGitHubRemote(remoteUrl);
  if (!gh || !commitHash) return null;
  return `${gh.webBase}/commit/${commitHash}`;
}
