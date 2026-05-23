"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGit, CommitInfo } from "../context/GitContext";
import { AuthorAvatar } from "./AuthorAvatar";
import { CommitContextMenu } from "./CommitContextMenu";
import { ConfirmDialog, PromptDialog } from "./PromptDialog";
import { useCommitAvatarOverrides } from "../hooks/useCommitAvatarOverrides";
import { avatarCacheKey } from "@/lib/avatar-url";
import { githubCommitUrl, parseGitHubRemote } from "@/lib/github-url";
import { openExternalUrl } from "@/lib/open-external";
import { useSettings } from "../context/SettingsContext";
import { NeuralGraph } from "./NeuralGraph";
import { githubApiFetch } from "@/lib/github-api";

const ROW_H = 54;
const NODE_R = 5;
const COL_W = 10;
const LANE_W = 28;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function refBadgeClass(ref: string, isHead: boolean): string {
  if (isHead || ref.includes("HEAD")) return "commit-ref-badge commit-ref-badge--head";
  if (ref.startsWith("origin/") || ref.startsWith("upstream/")) {
    return "commit-ref-badge commit-ref-badge--remote";
  }
  return "commit-ref-badge commit-ref-badge--branch";
}

interface Props {
  filter: string;
  remoteUrl?: string | null;
  onRevertConflicts?: (paths: string[]) => void;
}

type PendingAction =
  | { type: "amend"; commit: CommitInfo }
  | { type: "revert"; commit: CommitInfo }
  | { type: "cherry-pick"; commit: CommitInfo };

export function CommitHistoryList({ filter, remoteUrl = null, onRevertConflicts }: Props) {
  const git = useGit();
  const { commits, selectedCommit, selectCommit } = git;
  const { settings, updateSettings } = useSettings();
  const avatarOverrides = useCommitAvatarOverrides(commits);
  const [ciState, setCiState] = useState<Record<string, string>>({});
  const gh = parseGitHubRemote(remoteUrl);
  const [menu, setMenu] = useState<{
    commit: CommitInfo;
    x: number;
    y: number;
  } | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const runRevertOrCherryPick = async (
    action: "revert" | "cherry-pick",
    hash: string
  ) => {
    try {
      const result =
        action === "revert"
          ? await git.revertCommit(hash)
          : await git.cherryPickCommit(hash);
      if (result.conflict_paths.length > 0) {
        onRevertConflicts?.(result.conflict_paths);
      }
      alert(result.message);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (!gh) return;
    const head = commits.find((c) => c.is_head);
    if (!head) return;
    void githubApiFetch<{ state: string }>(
      `/repos/${gh.owner}/${gh.repo}/commits/${head.hash}/status`
    )
      .then((s) => setCiState({ [head.hash]: s.state }))
      .catch(() => {});
  }, [gh, commits]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return commits;
    return commits.filter(
      (c) =>
        c.summary.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q) ||
        c.short_hash.toLowerCase().includes(q)
    );
  }, [commits, filter]);

  const layout = useMemo(() => {
    const activeCols: (string | null)[] = [];
    return filtered.map((c, i) => {
      let col = activeCols.indexOf(c.hash);
      if (col === -1) {
        col = activeCols.indexOf(null);
        if (col === -1) {
          col = activeCols.length;
          activeCols.push(null);
        }
      }
      activeCols[col] = null;
      c.parents.forEach((p, pi) => {
        if (!activeCols.includes(p)) {
          if (pi === 0) activeCols[col] = p;
          else {
            const free = activeCols.indexOf(null);
            if (free !== -1) activeCols[free] = p;
            else activeCols.push(p);
          }
        }
      });
      return { commit: c, col, y: i * ROW_H + ROW_H / 2 };
    });
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div className="gh-empty-state">
        {commits.length === 0 ? "No commits yet" : "No commits match your filter"}
      </div>
    );
  }

  if (settings.historyGraphMode) {
    return (
      <>
        <div className="history-view-toggle">
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 11 }}
            onClick={() => updateSettings({ historyGraphMode: false })}
          >
            List view
          </button>
        </div>
        <NeuralGraph />
      </>
    );
  }

  return (
    <>
      <div className="history-view-toggle">
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 11 }}
          onClick={() => updateSettings({ historyGraphMode: true })}
        >
          Neural graph
        </button>
      </div>
      <div className="commit-history-list">
        <div className="commit-history-lane" style={{ minHeight: filtered.length * ROW_H }}>
          <svg
            className="commit-history-lane-svg"
            width={LANE_W}
            height={filtered.length * ROW_H}
            aria-hidden
          >
            {layout.map((node) =>
              node.commit.parents.map((parentHash, pi) => {
                const parentNode = layout.find((n) => n.commit.hash === parentHash);
                if (!parentNode) return null;
                const x1 = 14 + node.col * COL_W;
                const y1 = node.y;
                const x2 = 14 + parentNode.col * COL_W;
                const y2 = parentNode.y;
                return (
                  <path
                    key={`${node.commit.hash}-${pi}`}
                    d={
                      node.col === parentNode.col
                        ? `M${x1},${y1} L${x2},${y2}`
                        : `M${x1},${y1} C${x1},${y1 + ROW_H * 0.4} ${x2},${y2 - ROW_H * 0.4} ${x2},${y2}`
                    }
                    fill="none"
                    stroke="var(--gh-history-line)"
                    strokeWidth={1.5}
                  />
                );
              })
            )}
          </svg>
          {layout.map((node) => {
            const selected = selectedCommit?.hash === node.commit.hash;
            const isHead = node.commit.is_head;
            return (
              <div
                key={`dot-${node.commit.hash}`}
                className={`commit-lane-node${isHead ? " commit-lane-node--head" : ""}${selected ? " commit-lane-node--selected" : ""}`}
                style={{
                  top: node.y - NODE_R,
                  left: 14 + node.col * COL_W - NODE_R,
                }}
              />
            );
          })}
        </div>

        <div className="commit-history-rows" style={{ minHeight: filtered.length * ROW_H }}>
          {layout.map((node) => (
            <CommitRow
              key={node.commit.hash}
              commit={node.commit}
              avatarUrl={
                avatarOverrides.get(
                  avatarCacheKey(node.commit.author_name, node.commit.author_email)
                ) ?? node.commit.author_avatar
              }
              selected={selectedCommit?.hash === node.commit.hash}
              onSelect={() => selectCommit(node.commit)}
              ciState={ciState[node.commit.hash]}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ commit: node.commit, x: e.clientX, y: e.clientY });
              }}
              top={node.y - ROW_H / 2}
            />
          ))}
        </div>
      </div>

      {menu && (
        <CommitContextMenu
          commit={menu.commit}
          open
          position={{ x: menu.x, y: menu.y }}
          onClose={() => setMenu(null)}
          canAmend={menu.commit.is_head}
          viewOnGitHubDisabled={!githubCommitUrl(remoteUrl, menu.commit.hash)}
          onAmend={() => {
            setPending({ type: "amend", commit: menu.commit });
            setMenu(null);
          }}
          onRevert={() => {
            setPending({ type: "revert", commit: menu.commit });
            setMenu(null);
          }}
          onCherryPick={() => {
            setPending({ type: "cherry-pick", commit: menu.commit });
            setMenu(null);
          }}
          onViewOnGitHub={() => {
            const url = githubCommitUrl(remoteUrl, menu.commit.hash);
            if (url) void openExternalUrl(url);
          }}
        />
      )}

      <PromptDialog
        open={pending?.type === "amend"}
        title="Amend commit"
        label="Commit message (leave blank to keep current)"
        defaultValue={pending?.type === "amend" ? pending.commit.summary : ""}
        confirmLabel="Amend"
        onClose={() => setPending(null)}
        onConfirm={async (msg) => {
          if (pending?.type !== "amend") return;
          setPending(null);
          try {
            await git.amendCommit(msg || undefined);
          } catch (err: unknown) {
            alert(err instanceof Error ? err.message : String(err));
          }
        }}
      />

      <ConfirmDialog
        open={pending?.type === "revert"}
        title="Revert commit"
        message={
          pending?.type === "revert"
            ? `Revert "${pending.commit.summary}"?\n\nThis will apply the inverse changes to your working tree.`
            : ""
        }
        confirmLabel="Revert"
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending?.type !== "revert") return;
          const hash = pending.commit.hash;
          setPending(null);
          void runRevertOrCherryPick("revert", hash);
        }}
      />

      <ConfirmDialog
        open={pending?.type === "cherry-pick"}
        title="Cherry-pick commit"
        message={
          pending?.type === "cherry-pick"
            ? `Cherry-pick "${pending.commit.summary}" onto the current branch?`
            : ""
        }
        confirmLabel="Cherry-pick"
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending?.type !== "cherry-pick") return;
          const hash = pending.commit.hash;
          setPending(null);
          void runRevertOrCherryPick("cherry-pick", hash);
        }}
      />
    </>
  );
}

function CommitRow({
  commit,
  avatarUrl,
  selected,
  onSelect,
  onContextMenu,
  top,
  ciState,
}: {
  commit: CommitInfo;
  avatarUrl: string;
  selected: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  top: number;
  ciState?: string;
}) {
  return (
    <button
      type="button"
      className={`commit-row${selected ? " commit-row--selected" : ""}`}
      style={{ top, height: ROW_H }}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <AuthorAvatar
        name={commit.author_name}
        email={commit.author_email}
        avatarUrl={avatarUrl}
        size={24}
      />
      <div className="commit-row-body">
        <div className="commit-row-top">
          <span className="commit-row-summary" title={commit.summary}>
            {commit.summary}
          </span>
          {commit.refs.length > 0 && (
            <span className="commit-row-refs">
              {commit.refs.slice(0, 2).map((ref) => (
                <span key={ref} className={refBadgeClass(ref, commit.is_head)}>
                  {ref.replace(/^refs\/heads\//, "")}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="commit-row-meta">
          <span className="commit-row-author">{commit.author_name}</span>
          <span className="commit-row-dot">·</span>
          <span>{relativeTime(commit.timestamp)}</span>
          {ciState && (
            <>
              <span className="commit-row-dot">·</span>
              <span
                className={`commit-ci-badge commit-ci-badge--${ciState}`}
                title={`CI: ${ciState}`}
              >
                {ciState}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
