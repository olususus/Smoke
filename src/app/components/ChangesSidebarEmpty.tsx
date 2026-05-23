"use client";

import React from "react";
import { ArrowDown, ArrowUp, CheckCircle2 } from "lucide-react";
import { useGit } from "../context/GitContext";
import { getBranchSyncState } from "@/lib/branch-sync";

/** Minimal left-sidebar state when the working tree is clean (details live in the main pane). */
export function ChangesSidebarEmpty({ remoteUrl }: { remoteUrl: string | null }) {
  const git = useGit();
  const branch = git.repoInfo?.current_branch ?? "main";
  const { ahead, behind, branchUnpublished } = getBranchSyncState(remoteUrl, git.repoInfo);

  return (
    <div className="gh-changes-sidebar-empty">
      <CheckCircle2 size={22} className="gh-changes-sidebar-empty__icon" aria-hidden />
      <p className="gh-changes-sidebar-empty__title">No local changes</p>
      <p className="gh-changes-sidebar-empty__hint">
        {remoteUrl
          ? `Everything is committed on ${branch}`
          : `Nothing to commit on ${branch}`}
      </p>
      {remoteUrl && (branchUnpublished || ahead > 0 || behind > 0) && (
        <div className="gh-changes-sidebar-empty__chips">
          {behind > 0 && (
            <span className="gh-changes-sidebar-empty__chip">
              <ArrowDown size={11} aria-hidden />
              {behind} to pull
            </span>
          )}
          {(branchUnpublished || ahead > 0) && (
            <span className="gh-changes-sidebar-empty__chip gh-changes-sidebar-empty__chip--ahead">
              <ArrowUp size={11} aria-hidden />
              {branchUnpublished && ahead === 0 ? "publish branch" : `${ahead} to push`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
