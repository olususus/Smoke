/** Shared publish/push state derived from `get_repo_info`. */
export function getBranchSyncState(
  remoteUrl: string | null,
  repoInfo: { upstream_set?: boolean; ahead?: number; behind?: number } | null | undefined
) {
  const upstreamSet = repoInfo?.upstream_set ?? false;
  const ahead = repoInfo?.ahead ?? 0;
  const behind = repoInfo?.behind ?? 0;
  const branchUnpublished = !!remoteUrl && !upstreamSet;
  const canPush = !!remoteUrl && (branchUnpublished || ahead > 0);
  const canPull = !!remoteUrl && behind > 0;
  const pushLabel = branchUnpublished ? "Publish branch" : "Push";
  const pushShortLabel = branchUnpublished ? "Publish" : "Push";
  const pushTitle = branchUnpublished
    ? "Publish this branch to origin"
    : ahead > 0
      ? `Push ${ahead} commit${ahead === 1 ? "" : "s"} to origin`
      : "Already up to date with origin";

  return {
    upstreamSet,
    ahead,
    behind,
    branchUnpublished,
    canPush,
    canPull,
    pushLabel,
    pushShortLabel,
    pushTitle,
  };
}

export type PrimarySyncKind = "push" | "pull" | "fetch" | "none";

export function getPrimarySyncAction(
  remoteUrl: string | null,
  sync: ReturnType<typeof getBranchSyncState>
): { kind: PrimarySyncKind; title: string; subtitle: string; disabled: boolean } {
  if (!remoteUrl) {
    return {
      kind: "none",
      title: "No remote",
      subtitle: "Add a remote to sync with GitHub",
      disabled: true,
    };
  }

  if (sync.branchUnpublished || sync.ahead > 0) {
    const title = sync.branchUnpublished ? "Publish branch" : "Push origin";
    const subtitle = sync.branchUnpublished
      ? "This branch is not on origin yet"
      : sync.ahead === 1
        ? "1 commit to push to origin"
        : `${sync.ahead} commits to push to origin`;
    return { kind: "push", title, subtitle, disabled: !sync.canPush };
  }

  if (sync.behind > 0) {
    return {
      kind: "pull",
      title: "Pull origin",
      subtitle:
        sync.behind === 1
          ? "1 commit to pull from origin"
          : `${sync.behind} commits to pull from origin`,
      disabled: false,
    };
  }

  return {
    kind: "fetch",
    title: "Fetch origin",
    subtitle: "Up to date with origin",
    disabled: false,
  };
}
