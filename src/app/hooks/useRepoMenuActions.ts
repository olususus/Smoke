"use client";

import { useCallback, useMemo } from "react";
import { useGit } from "../context/GitContext";
import {
  githubBranchUrl,
  githubCompareUrl,
  githubCreatePrUrl,
  githubIssuesUrl,
  parseGitHubRemote,
} from "@/lib/github-url";
import { openExternalUrl } from "@/lib/open-external";
import { confirmApp } from "@/lib/app-dialog";
import type { AppMenubarActions } from "../components/AppMenubar";
import type { BranchPickerOptions } from "../components/BranchPickerDialog";

function defaultBranchName(branches: { name: string; is_remote: boolean }[]): string | null {
  const local = branches.filter((b) => !b.is_remote);
  const main = local.find((b) => b.name === "main");
  if (main) return "main";
  const master = local.find((b) => b.name === "master");
  if (master) return "master";
  return local[0]?.name ?? null;
}

export function useRepoMenuActions(options: {
  remoteUrl: string | null;
  hasLocalChanges: boolean;
  hasStash: boolean;
  onNewBranch: () => void;
  onPull: () => void;
  onPush: () => void;
  onPublishBranch?: () => void;
  publishBranchDisabled?: boolean;
  branchUnpublished?: boolean;
  onFetch: () => void;
  onDiscardAll: () => void;
  onStashSave: () => void;
  onStashPop: () => void;
  onStashApply: () => void;
  onShowStashed?: () => void;
  onRenameBranch?: () => void;
  onDeleteBranch?: () => void;
  onSyncMessage?: (msg: string) => void;
  onMergeConflicts?: (paths: string[]) => void;
  onCompareBranchInApp?: (baseBranch: string, compareBranch: string) => void;
  onPreviewPullRequest?: () => void;
  requestBranchPick: (opts: BranchPickerOptions) => Promise<string | null>;
}): AppMenubarActions {
  const git = useGit();
  const currentBranch = git.repoInfo?.current_branch ?? "main";
  const gh = parseGitHubRemote(options.remoteUrl);
  const hasGitHub = !!gh;

  const handleUpdateFromMain = useCallback(async () => {
    const base = defaultBranchName(git.branches);
    if (!base) {
      alert("Could not find a default branch (main/master).");
      return;
    }
    if (base === currentBranch) {
      alert(`Already on ${base}.`);
      return;
    }
    try {
      const result = await git.mergeBranch(base);
      options.onSyncMessage?.(result.message);
      if (result.conflict_paths.length > 0) {
        options.onMergeConflicts?.(result.conflict_paths);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [git, currentBranch, options]);

  const handleCompareBranch = useCallback(async () => {
    const other = await options.requestBranchPick({
      title: "Compare to branch",
      description: "Show diff between the selected branch and your current branch.",
      excludeCurrent: true,
      localsOnly: true,
    });
    if (!other) return;
    try {
      await git.getBranchDiff(other, currentBranch);
      options.onCompareBranchInApp?.(other, currentBranch);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [options, git, currentBranch]);

  const handleMergeIntoCurrent = useCallback(async () => {
    const other = await options.requestBranchPick({
      title: "Merge into current branch",
      excludeCurrent: true,
      localsOnly: true,
    });
    if (!other) return;
    try {
      const result = await git.mergeBranch(other);
      options.onSyncMessage?.(result.message);
      if (result.conflict_paths.length > 0) {
        options.onMergeConflicts?.(result.conflict_paths);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [options, git]);

  const handleSquashMerge = useCallback(async () => {
    const other = await options.requestBranchPick({
      title: "Squash and merge into current",
      excludeCurrent: true,
      localsOnly: true,
    });
    if (!other) return;
    if (
      !(await confirmApp(
        `Squash-merge "${other}" into "${currentBranch}"? This creates one commit.`
      ))
    ) {
      return;
    }
    try {
      const result = await git.squashMergeBranch(other);
      options.onSyncMessage?.(result.message);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [options, git, currentBranch]);

  const handleRebase = useCallback(async () => {
    const upstream = await options.requestBranchPick({
      title: "Rebase current branch",
      description: "Rebase onto the selected branch.",
      excludeCurrent: true,
      localsOnly: true,
    });
    if (!upstream) return;
    if (!(await confirmApp(`Rebase "${currentBranch}" onto "${upstream}"?`))) return;
    try {
      const result = await git.rebaseOnto(upstream);
      options.onSyncMessage?.(result.message);
      if (result.conflict_paths.length > 0) {
        options.onMergeConflicts?.(result.conflict_paths);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [options, git, currentBranch]);

  const handleCompareOnGitHub = useCallback(async () => {
    const base = defaultBranchName(git.branches);
    if (!base) {
      alert("Could not determine base branch.");
      return;
    }
    const url = githubCompareUrl(options.remoteUrl, base, currentBranch);
    if (url) await openExternalUrl(url);
    else alert("GitHub compare requires a github.com remote.");
  }, [git.branches, options.remoteUrl, currentBranch]);

  const handleViewBranchOnGitHub = useCallback(async () => {
    const url = githubBranchUrl(options.remoteUrl, currentBranch);
    if (url) await openExternalUrl(url);
    else alert("View on GitHub requires a github.com remote.");
  }, [options.remoteUrl, currentBranch]);

  const handleCreatePullRequest = useCallback(async () => {
    const base = defaultBranchName(git.branches);
    if (!base) {
      alert("Could not determine base branch.");
      return;
    }
    const url = githubCreatePrUrl(options.remoteUrl, base, currentBranch);
    if (url) await openExternalUrl(url);
    else alert("Create pull request requires a github.com remote.");
  }, [git.branches, options.remoteUrl, currentBranch]);

  const handleReportIssue = useCallback(() => {
    void openExternalUrl(githubIssuesUrl());
  }, []);

  const handleUserGuides = useCallback(() => {
    void openExternalUrl("https://docs.github.com/en/desktop");
  }, []);

  const handleShowLogs = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const dir = await invoke<string>("get_log_dir");
      await invoke("open_repo_folder", { repoPath: dir });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return useMemo(
    () => ({
      onNewBranch: options.onNewBranch,
      onRenameBranch: options.onRenameBranch,
      onDeleteBranch: options.onDeleteBranch,
      onShowStashed: options.onShowStashed,
      onDiscardAll: options.onDiscardAll,
      onStashChanges: options.onStashSave,
      onStashPop: options.onStashPop,
      onStashApply: options.onStashApply,
      onUpdateFromMain: () => void handleUpdateFromMain(),
      onCompareBranch: () => void handleCompareBranch(),
      onMergeIntoCurrent: () => void handleMergeIntoCurrent(),
      onSquashMerge: () => void handleSquashMerge(),
      onRebase: () => void handleRebase(),
      onCompareOnGitHub: () => void handleCompareOnGitHub(),
      onViewBranchOnGitHub: () => void handleViewBranchOnGitHub(),
      onCreatePullRequest: () => void handleCreatePullRequest(),
      onPreviewPullRequest: options.onPreviewPullRequest,
      onPull: options.onPull,
      onPush: options.onPush,
      onPublishBranch: options.onPublishBranch,
      publishBranchDisabled: options.publishBranchDisabled,
      branchUnpublished: options.branchUnpublished,
      onFetch: options.onFetch,
      onViewOnGitHub: () => void handleViewBranchOnGitHub(),
      onReportIssue: handleReportIssue,
      onShowUserGuides: handleUserGuides,
      onShowLogs: () => void handleShowLogs(),
      hasLocalChanges: options.hasLocalChanges,
      stashPopDisabled: !options.hasStash,
      viewOnGitHubDisabled: !hasGitHub,
      githubActionsDisabled: !hasGitHub,
    }),
    [
      options,
      hasGitHub,
      handleUpdateFromMain,
      handleCompareBranch,
      handleMergeIntoCurrent,
      handleSquashMerge,
      handleRebase,
      handleCompareOnGitHub,
      handleViewBranchOnGitHub,
      handleCreatePullRequest,
      handleReportIssue,
      handleUserGuides,
      handleShowLogs,
    ]
  );
}
