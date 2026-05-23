"use client";

import React from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderOpen,
  GitCommitVertical,
  History,
  RefreshCw,
} from "lucide-react";
import { useGit } from "../context/GitContext";
import { AuthorAvatar } from "./AuthorAvatar";
import { useCommitAvatarOverrides } from "../hooks/useCommitAvatarOverrides";
import { avatarCacheKey } from "@/lib/avatar-url";
import { relativeTimeFromUnix } from "@/lib/relative-time";
import { getBranchSyncState } from "@/lib/branch-sync";

export interface ChangesCleanStateProps {
  variant: "compact" | "expanded";
  remoteUrl: string | null;
  lastFetchLabel: string;
  fetching: boolean;
  pulling: boolean;
  pushing: boolean;
  onOpenHistory: () => void;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onOpenFolder: () => void;
  onViewOnGitHub?: () => void;
  onPublish?: () => void;
}

function syncStatusText(
  ahead: number,
  behind: number,
  hasRemote: boolean,
  upstreamSet: boolean
): { label: string; detail: string } {
  if (!hasRemote) {
    return { label: "No remote", detail: "Add a remote to sync with GitHub" };
  }
  if (!upstreamSet) {
    return {
      label: "Publish branch",
      detail: "This branch has not been pushed to origin yet",
    };
  }
  if (ahead === 0 && behind === 0) {
    return { label: "Up to date", detail: "Your branch matches the remote" };
  }
  const parts: string[] = [];
  if (ahead > 0) parts.push(`${ahead} commit${ahead === 1 ? "" : "s"} to push`);
  if (behind > 0) parts.push(`${behind} commit${behind === 1 ? "" : "s"} to pull`);
  return { label: parts.join(" · "), detail: "Fetch to refresh remote status" };
}

export function ChangesCleanState({
  variant,
  remoteUrl,
  lastFetchLabel,
  fetching,
  pulling,
  pushing,
  onOpenHistory,
  onFetch,
  onPull,
  onPush,
  onOpenFolder,
  onViewOnGitHub,
  onPublish,
}: ChangesCleanStateProps) {
  const git = useGit();
  const lastCommit = git.commits[0] ?? null;
  const avatarOverrides = useCommitAvatarOverrides(lastCommit ? [lastCommit] : []);
  const lastCommitAvatar = lastCommit
    ? avatarOverrides.get(avatarCacheKey(lastCommit.author_name, lastCommit.author_email)) ??
      lastCommit.author_avatar
    : undefined;
  const branch = git.repoInfo?.current_branch ?? "main";
  const { ahead, behind, branchUnpublished, canPush, pushLabel, upstreamSet } =
    getBranchSyncState(remoteUrl, git.repoInfo);
  const sync = syncStatusText(ahead, behind, !!remoteUrl, upstreamSet);
  const isExpanded = variant === "expanded";

  return (
    <div
      className={`gh-clean-state${isExpanded ? " gh-clean-state--expanded" : " gh-clean-state--compact"}`}
    >
      <div className="gh-clean-state__hero">
        <CheckCircle2 size={isExpanded ? 40 : 28} className="gh-clean-state__icon" aria-hidden />
        <h2 className="gh-clean-state__title">Working tree clean</h2>
        <p className="gh-clean-state__subtitle">No local changes on {branch}</p>
      </div>

      <div className="gh-clean-state__sync">
        <span className="gh-clean-state__sync-label">{sync.label}</span>
        <span className="gh-clean-state__sync-detail">
          {remoteUrl ? lastFetchLabel : sync.detail}
        </span>
        {(ahead > 0 || behind > 0) && remoteUrl && (
          <div className="gh-clean-state__chips">
            {behind > 0 && (
              <span className="gh-clean-state__chip gh-clean-state__chip--behind">
                <ArrowDown size={12} aria-hidden />
                {behind} behind
              </span>
            )}
            {ahead > 0 && (
              <span className="gh-clean-state__chip gh-clean-state__chip--ahead">
                <ArrowUp size={12} aria-hidden />
                {ahead} ahead
              </span>
            )}
          </div>
        )}
      </div>

      {lastCommit ? (
        <div className="gh-clean-state__card">
          <div className="gh-clean-state__card-label">
            <GitCommitVertical size={14} aria-hidden />
            Latest commit
          </div>
          <div className="gh-clean-state__commit-row">
            <AuthorAvatar
              name={lastCommit.author_name}
              email={lastCommit.author_email}
              avatarUrl={lastCommitAvatar}
              size={isExpanded ? 36 : 28}
            />
            <div className="gh-clean-state__commit-body">
              <p className="gh-clean-state__commit-summary">{lastCommit.summary}</p>
              <p className="gh-clean-state__commit-meta">
                <span className="gh-clean-state__hash">{lastCommit.short_hash}</span>
                <span className="gh-clean-state__author">{lastCommit.author_name}</span>
                <span className="gh-clean-state__time">
                  <Clock size={11} aria-hidden />
                  {relativeTimeFromUnix(lastCommit.timestamp)}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="gh-clean-state__card gh-clean-state__card--muted">
          <p className="gh-clean-state__empty-commit">No commits in this repository yet</p>
        </div>
      )}

      {isExpanded && ahead > 0 && git.commits.length > 1 && (
        <div className="gh-clean-state__unpushed">
          <div className="gh-clean-state__card-label">Unpushed commits</div>
          <ul className="gh-clean-state__unpushed-list">
            {git.commits.slice(0, Math.min(ahead, 5)).map((c) => (
              <li key={c.hash} className="gh-clean-state__unpushed-item">
                <span className="gh-clean-state__hash">{c.short_hash}</span>
                <span className="gh-clean-state__unpushed-summary">{c.summary}</span>
              </li>
            ))}
            {ahead > 5 && (
              <li className="gh-clean-state__unpushed-more">+{ahead - 5} more</li>
            )}
          </ul>
        </div>
      )}

      <div className={`gh-clean-state__actions${isExpanded ? " gh-clean-state__actions--expanded" : ""}`}>
        <button type="button" className="gh-clean-state__btn" onClick={onOpenHistory}>
          <History size={14} aria-hidden />
          History
        </button>
        {!remoteUrl && onPublish && (
          <button
            type="button"
            className="gh-clean-state__btn gh-clean-state__btn--primary"
            onClick={onPublish}
          >
            <ArrowUp size={14} aria-hidden />
            Publish repository
          </button>
        )}
        {remoteUrl && (
          <>
            <button
              type="button"
              className="gh-clean-state__btn"
              disabled={fetching || pulling || pushing}
              onClick={onFetch}
            >
              <RefreshCw size={14} className={fetching ? "animate-spin" : ""} aria-hidden />
              Fetch
            </button>
            <button
              type="button"
              className="gh-clean-state__btn"
              disabled={pulling || fetching || behind === 0}
              onClick={onPull}
            >
              <ArrowDown size={14} className={pulling ? "animate-spin" : ""} aria-hidden />
              Pull
            </button>
            <button
              type="button"
              className="ghd-add-trigger ghd-add-trigger--sync"
              disabled={pushing || fetching || !canPush}
              onClick={onPush}
            >
              <ArrowUp size={14} className={pushing ? "animate-spin" : ""} aria-hidden />
              <span className="ghd-add-trigger__label">{pushLabel}</span>
            </button>
          </>
        )}
        <button type="button" className="gh-clean-state__btn" onClick={onOpenFolder}>
          <FolderOpen size={14} aria-hidden />
          Open folder
        </button>
        {remoteUrl && onViewOnGitHub && (
          <button type="button" className="gh-clean-state__btn" onClick={onViewOnGitHub}>
            <ExternalLink size={14} aria-hidden />
            GitHub
          </button>
        )}
      </div>
    </div>
  );
}
