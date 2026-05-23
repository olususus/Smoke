"use client";

import { useEffect } from "react";
import { matchRepoShortcut } from "@/lib/menu-shortcuts";
import type { AppMenubarActions } from "../components/AppMenubar";

export function useRepoMenuShortcuts(
  enabled: boolean,
  actions: AppMenubarActions | undefined
) {
  useEffect(() => {
    if (!enabled || !actions) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      const action = matchRepoShortcut(e);
      if (!action) return;

      const run = () => {
        switch (action) {
          case "newBranch":
            actions.onNewBranch?.();
            break;
          case "renameBranch":
            actions.onRenameBranch?.();
            break;
          case "deleteBranch":
            actions.onDeleteBranch?.();
            break;
          case "discardAll":
            if (!actions.hasLocalChanges) return;
            actions.onDiscardAll?.();
            break;
          case "stashAll":
            if (!actions.hasLocalChanges) return;
            actions.onStashChanges?.();
            break;
          case "updateFromMain":
            actions.onUpdateFromMain?.();
            break;
          case "compareBranch":
            actions.onCompareBranch?.();
            break;
          case "mergeIntoCurrent":
            actions.onMergeIntoCurrent?.();
            break;
          case "squashMerge":
            actions.onSquashMerge?.();
            break;
          case "rebase":
            actions.onRebase?.();
            break;
          case "fetch":
            actions.onFetch?.();
            break;
          case "pull":
            actions.onPull?.();
            break;
          case "push":
            actions.onPush?.();
            break;
          case "previewPr":
            if (actions.githubActionsDisabled) return;
            actions.onPreviewPullRequest?.();
            break;
          case "compareOnGitHub":
            if (actions.githubActionsDisabled) return;
            actions.onCompareOnGitHub?.();
            break;
          case "viewBranchOnGitHub":
            if (actions.githubActionsDisabled) return;
            actions.onViewBranchOnGitHub?.();
            break;
          case "createPullRequest":
            if (actions.githubActionsDisabled) return;
            actions.onCreatePullRequest?.();
            break;
          default:
            break;
        }
      };

      e.preventDefault();
      run();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, actions]);
}
