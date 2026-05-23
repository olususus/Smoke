import type { WorkingTreeStatus } from "@/app/context/GitContext";

export function workingTreeFingerprint(status: WorkingTreeStatus): string {
  const paths = [
    ...status.staged.map((f) => `s:${f.path}:${f.status}`),
    ...status.unstaged.map((f) => `u:${f.path}:${f.status}`),
    ...status.untracked.map((f) => `t:${f.path}`),
    ...status.conflicts.map((f) => `c:${f.path}`),
  ];
  paths.sort();
  return paths.join("|");
}

export function headCommitHash(commits: { hash: string }[]): string | null {
  return commits[0]?.hash ?? null;
}
