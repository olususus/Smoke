import { githubApiFetch, githubApiRequest } from "./github-api";

export interface PullRequestSummary {
  number: number;
  title: string;
  state: string;
  user: { login: string; avatar_url?: string };
  head: { ref: string; sha: string };
  base: { ref: string };
  created_at: string;
  updated_at: string;
  draft?: boolean;
  mergeable_state?: string;
}

export interface PullRequestComment {
  id: number;
  user: { login: string; avatar_url?: string };
  body: string;
  created_at: string;
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string | null;
}

export function pullRequestsPath(owner: string, repo: string, state = "open") {
  return `/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`;
}

export async function listPullRequests(
  owner: string,
  repo: string,
  state = "open"
): Promise<PullRequestSummary[]> {
  return githubApiFetch<PullRequestSummary[]>(pullRequestsPath(owner, repo, state));
}

export async function getPullRequest(
  owner: string,
  repo: string,
  number: number
): Promise<PullRequestSummary & { body?: string; mergeable?: boolean }> {
  return githubApiFetch(`/repos/${owner}/${repo}/pulls/${number}`);
}

export async function listPullComments(
  owner: string,
  repo: string,
  number: number
): Promise<PullRequestComment[]> {
  return githubApiFetch<PullRequestComment[]>(
    `/repos/${owner}/${repo}/issues/${number}/comments`
  );
}

export async function listPullFiles(
  owner: string,
  repo: string,
  number: number
): Promise<PullRequestFile[]> {
  return githubApiFetch<PullRequestFile[]>(
    `/repos/${owner}/${repo}/pulls/${number}/files`
  );
}

export async function listCheckRuns(
  owner: string,
  repo: string,
  ref: string
): Promise<CheckRun[]> {
  const data = await githubApiFetch<{ check_runs: CheckRun[] }>(
    `/repos/${owner}/${repo}/commits/${ref}/check-runs?per_page=100`
  );
  return data.check_runs ?? [];
}

export async function mergePullRequest(
  owner: string,
  repo: string,
  number: number,
  mergeMethod: "merge" | "squash" | "rebase"
): Promise<void> {
  await githubApiRequest("PUT", `/repos/${owner}/${repo}/pulls/${number}/merge`, {
    merge_method: mergeMethod,
  });
}

export async function searchReviewRequestedPrs(login: string): Promise<
  { number: number; title: string; repository_url: string; html_url: string }[]
> {
  const q = encodeURIComponent(`is:pr is:open review-requested:${login}`);
  const data = await githubApiFetch<{
    items: { number: number; title: string; repository_url: string; html_url: string }[];
  }>(`/search/issues?q=${q}&per_page=20`);
  return data.items ?? [];
}
