"use client";

import React from "react";
import {
  Loader2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatGithubApiError } from "@/lib/github-api";
import type { PullRequestInbox } from "../hooks/usePullRequests";
import type { CheckRun } from "@/lib/github-pulls";
import { MergePullRequestDialog } from "./MergePullRequestDialog";
import { openExternalUrl } from "@/lib/open-external";

function checkIcon(run: CheckRun) {
  if (run.status !== "completed") return <Clock size={14} style={{ color: "var(--warning)" }} />;
  if (run.conclusion === "success") return <CheckCircle2 size={14} style={{ color: "var(--success)" }} />;
  return <XCircle size={14} style={{ color: "var(--danger)" }} />;
}

interface Props {
  inbox: PullRequestInbox;
}

export function PullRequestDetailView({ inbox }: Props) {
  const {
    gh,
    owner,
    repo,
    selected,
    detail,
    comments,
    files,
    checks,
    checksError,
    detailLoading,
    detailError,
    mergeOpen,
    setMergeOpen,
    handleMerge,
  } = inbox;

  if (!gh) {
    return (
      <main className="gh-diff-pane">
        <div className="gh-empty-state">Pull requests require a GitHub remote.</div>
      </main>
    );
  }

  return (
    <>
      <main className="gh-diff-pane pr-detail-pane">
        {detailLoading && (
          <div className="pr-panel__detail-loading">
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--aero-sky)" }} />
          </div>
        )}

        {!detailLoading && detailError && (
          <div className="pr-panel__error-banner" role="alert" style={{ margin: 16 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, color: "var(--danger)" }} />
            <p className="pr-panel__error-text">{detailError}</p>
          </div>
        )}

        {!detailLoading && !detail && !detailError && (
          <div className="gh-empty-state">Select a pull request from the list</div>
        )}

        {!detailLoading && detail && (
          <div className="pr-detail-pane__content">
            <header className="pr-panel__detail-header">
              <h3>#{detail.number} {detail.title}</h3>
              <div className="pr-panel__detail-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    void openExternalUrl(
                      `https://github.com/${owner}/${repo}/pull/${detail.number}`
                    )
                  }
                >
                  Open on GitHub
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setMergeOpen(true)}>
                  Merge…
                </button>
              </div>
            </header>

            {detail.body && <p className="pr-panel__body">{detail.body}</p>}

            <section className="pr-panel__section">
              <h4>Checks</h4>
              {checksError && <p className="pr-panel__muted">{checksError}</p>}
              {!checksError && checks.length === 0 && (
                <p className="pr-panel__muted">No check runs</p>
              )}
              {checks.length > 0 && (
                <ul className="pr-panel__checks">
                  {checks.map((run) => (
                    <li key={run.id}>
                      {checkIcon(run)}
                      <span>{run.name}</span>
                      {run.html_url && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ marginLeft: "auto", fontSize: 11 }}
                          onClick={() => void openExternalUrl(run.html_url!)}
                        >
                          Logs
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pr-panel__section">
              <h4>
                <MessageSquare size={14} /> Conversation
              </h4>
              {comments.length === 0 ? (
                <p className="pr-panel__muted">No comments</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="pr-panel__comment">
                    <strong>@{c.user.login}</strong>
                    <p>{c.body}</p>
                  </div>
                ))
              )}
            </section>

            <section className="pr-panel__section">
              <h4>Files changed ({files.length})</h4>
              {files.map((f) => (
                <div key={f.filename} className="pr-panel__file">
                  <span>{f.filename}</span>
                  <span className="diff-stat-add">+{f.additions}</span>
                  <span className="diff-stat-del">−{f.deletions}</span>
                  {f.patch && (
                    <pre className="pr-panel__patch">
                      {f.patch.slice(0, 4000)}
                      {f.patch.length > 4000 ? "\n…" : ""}
                    </pre>
                  )}
                </div>
              ))}
            </section>
          </div>
        )}
      </main>

      <MergePullRequestDialog
        open={mergeOpen}
        prNumber={selected ?? 0}
        onClose={() => setMergeOpen(false)}
        onMerge={(m) => {
          void handleMerge(m).catch((e) => alert(formatGithubApiError(e)));
        }}
      />
    </>
  );
}
