"use client";

import React from "react";
import { ArrowDown, ArrowUp, Loader2, RefreshCw } from "lucide-react";
import { getBranchSyncState, getPrimarySyncAction } from "@/lib/branch-sync";

export type SyncFeedbackKind = "success" | null;

export interface ToolbarSyncBarProps {
  remoteUrl: string | null;
  repoInfo: { upstream_set?: boolean; ahead?: number; behind?: number } | null | undefined;
  feedbackText?: string | null;
  feedbackKind?: SyncFeedbackKind;
  fetching: boolean;
  pulling: boolean;
  pushing: boolean;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
}

export function ToolbarSyncBar({
  remoteUrl,
  repoInfo,
  feedbackText,
  feedbackKind = null,
  fetching,
  pulling,
  pushing,
  onFetch,
  onPull,
  onPush,
}: ToolbarSyncBarProps) {
  const sync = getBranchSyncState(remoteUrl, repoInfo);
  const primary = getPrimarySyncAction(remoteUrl, sync);
  const busy = fetching || pulling || pushing;

  const runPrimary = () => {
    if (primary.disabled || busy) return;
    switch (primary.kind) {
      case "push":
        onPush();
        break;
      case "pull":
        onPull();
        break;
      case "fetch":
        onFetch();
        break;
      default:
        break;
    }
  };

  const subtitle = busy
    ? busySubtitle(pushing, pulling, fetching, primary.kind)
    : feedbackText ?? primary.subtitle;

  const actionBusy =
    (pushing && primary.kind === "push") ||
    (pulling && primary.kind === "pull") ||
    (fetching && primary.kind === "fetch");

  return (
    <div className="gh-toolbar-sync-bar">
      <div className="gh-toolbar-sync-bar__arrows" role="group" aria-label="Pull and push">
        <button
          type="button"
          className="gh-toolbar-sync-bar__arrow"
          title="Pull from origin"
          disabled={busy || !remoteUrl}
          onClick={() => onPull()}
        >
          <ArrowDown size={15} className={pulling ? "animate-spin" : ""} aria-hidden />
          {sync.behind > 0 && (
            <span className="gh-toolbar-sync-bar__count">{sync.behind}</span>
          )}
        </button>
        <button
          type="button"
          className="gh-toolbar-sync-bar__arrow"
          title={sync.pushTitle}
          disabled={busy || !sync.canPush}
          onClick={() => onPush()}
        >
          <ArrowUp size={15} className={pushing ? "animate-spin" : ""} aria-hidden />
          {sync.ahead > 0 && (
            <span className="gh-toolbar-sync-bar__count gh-toolbar-sync-bar__count--ahead">
              {sync.ahead}
            </span>
          )}
        </button>
      </div>

      <button
        type="button"
        className={`ghd-add-trigger ghd-add-trigger--sync${actionBusy ? " ghd-add-trigger--busy" : ""}`}
        disabled={primary.disabled || busy || primary.kind === "none"}
        aria-busy={actionBusy}
        title={feedbackText ? `${primary.title}\n${feedbackText}` : primary.title}
        onClick={runPrimary}
      >
        {actionBusy ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : primary.kind === "push" ? (
          <ArrowUp size={15} strokeWidth={2.25} aria-hidden />
        ) : primary.kind === "pull" ? (
          <ArrowDown size={15} strokeWidth={2.25} aria-hidden />
        ) : (
          <RefreshCw size={15} strokeWidth={2.25} aria-hidden />
        )}
        <span className="ghd-add-trigger__stack">
          <span className="ghd-add-trigger__label">{primaryBusyLabel(primary, pushing, pulling, fetching)}</span>
          <span
            className={`ghd-add-trigger__sub${
              feedbackKind === "success" ? " ghd-add-trigger__sub--ok" : ""
            }`}
          >
            {subtitle}
          </span>
        </span>
      </button>

      <button
        type="button"
        className="gh-toolbar-sync-bar__fetch-icon"
        title="Fetch from origin"
        disabled={fetching || !remoteUrl}
        aria-label="Fetch from origin"
        onClick={() => onFetch()}
      >
        {fetching ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : (
          <RefreshCw size={16} aria-hidden />
        )}
      </button>
    </div>
  );
}

function busySubtitle(
  pushing: boolean,
  pulling: boolean,
  fetching: boolean,
  kind: ReturnType<typeof getPrimarySyncAction>["kind"]
): string {
  if (pushing) return "Pushing to origin…";
  if (pulling) return "Pulling from origin…";
  if (fetching) return "Fetching from origin…";
  if (kind === "push") return "Pushing to origin…";
  if (kind === "pull") return "Pulling from origin…";
  return "Fetching from origin…";
}

function primaryBusyLabel(
  primary: ReturnType<typeof getPrimarySyncAction>,
  pushing: boolean,
  pulling: boolean,
  fetching: boolean
): string {
  if (pushing) return "Pushing…";
  if (pulling) return "Pulling…";
  if (fetching && primary.kind === "fetch") return "Fetching…";
  if (primary.kind === "push") {
    return primary.title.startsWith("Publish") ? "Publish branch" : "Push origin";
  }
  if (primary.kind === "pull") return "Pull origin";
  if (primary.kind === "fetch") return "Fetch origin";
  return "No remote";
}
