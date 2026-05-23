import { formatGithubApiError, githubApiFetch, githubApiRequest } from "./github-api";

export interface GitHubOrg {
  login: string;
  avatar_url: string;
}

export interface GitHubLicense {
  key: string;
  name: string;
  spdx_id: string | null;
}

export interface CreatedGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  clone_url: string;
  html_url: string;
  private: boolean;
}

const REPO_NAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

export function validateRepoName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Repository name is required.";
  if (trimmed.length > 100) return "Repository name must be 100 characters or fewer.";
  if (!REPO_NAME_RE.test(trimmed)) {
    return "Use letters, numbers, hyphens, underscores, and dots. Name cannot start or end with a dot or hyphen.";
  }
  return null;
}

export async function listUserOrgs(): Promise<GitHubOrg[]> {
  try {
    const data = await githubApiFetch<GitHubOrg[]>("/user/orgs?per_page=100");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function listGitignoreTemplates(): Promise<string[]> {
  const data = await githubApiFetch<string[]>("/gitignore/templates");
  return Array.isArray(data) ? data.sort((a, b) => a.localeCompare(b)) : [];
}

export async function fetchGitignoreTemplate(name: string): Promise<string> {
  const data = await githubApiFetch<{ name?: string; source?: string }>(
    `/gitignore/templates/${encodeURIComponent(name)}`
  );
  return data.source ?? "";
}

export async function listLicenses(): Promise<GitHubLicense[]> {
  const data = await githubApiFetch<GitHubLicense[]>("/licenses");
  if (!Array.isArray(data)) return [];
  return data
    .filter((l) => l.key && l.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchLicenseBody(key: string): Promise<string> {
  const data = await githubApiFetch<{ body?: string }>(`/licenses/${encodeURIComponent(key)}`);
  return data.body ?? "";
}

export async function createGitHubRepository(options: {
  ownerLogin: string;
  userLogin: string;
  name: string;
  description: string;
  isPrivate: boolean;
}): Promise<CreatedGitHubRepo> {
  const body = {
    name: options.name,
    description: options.description || undefined,
    private: options.isPrivate,
    auto_init: false,
  };
  const path =
    options.ownerLogin === options.userLogin
      ? "/user/repos"
      : `/orgs/${encodeURIComponent(options.ownerLogin)}/repos`;

  try {
    return await githubApiRequest<CreatedGitHubRepo>("POST", path, body);
  } catch (err) {
    throw new Error(formatGithubApiError(err));
  }
}
