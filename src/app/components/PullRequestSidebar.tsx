"use client";

import React from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import type { PullRequestInbox } from "../hooks/usePullRequests";

interface Props {
  inbox: PullRequestInbox;
}

export function PullRequestSidebar({ inbox }: Props) {
  const {
    gh,
    prs,
    filtered,
    selected,
    listLoading,
    listError,
    filter,
    setFilter,
    loadList,
    selectPr,
  } = inbox;

  if (!gh) {
    return (
      <div className="gh-empty-state" style={{ padding: 16 }}>
        Pull requests require a GitHub remote (github.com).
      </div>
    );
  }

  return (
    <div className="pr-sidebar">
      <div className="gh-history-filter">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter pull requests"
        />
      </div>

      {listError && (
        <div className="pr-panel__error-banner" role="alert">
          <AlertTriangle size={14} style={{ flexShrink: 0, color: "var(--danger)" }} />
          <p className="pr-panel__error-text">{listError}</p>
        </div>
      )}

      <div className="pr-sidebar__toolbar">
        <span className="pr-sidebar__meta">
          {listLoading ? "Loading…" : `${prs.length} open`}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 11, padding: "4px 8px" }}
          onClick={() => void loadList()}
          disabled={listLoading}
        >
          {listLoading ? <Loader2 size={12} className="animate-spin" /> : "Refresh"}
        </button>
      </div>

      <div className="pr-sidebar__list">
        {listLoading && prs.length === 0 ? (
          <div className="pr-panel__list-placeholder">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--aero-sky)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="pr-panel__list-placeholder">
            <span>
              {prs.length === 0
                ? listError
                  ? "Could not load"
                  : "No open pull requests"
                : "No matches"}
            </span>
          </div>
        ) : (
          <ul className="pr-panel__items">
            {filtered.map((pr) => (
              <li key={pr.number}>
                <button
                  type="button"
                  className={`pr-panel__item${selected === pr.number ? " pr-panel__item--active" : ""}`}
                  onClick={() => selectPr(pr.number)}
                >
                  <span className="pr-panel__item-title">#{pr.number} {pr.title}</span>
                  <span className="pr-panel__item-meta">
                    {pr.head.ref} → {pr.base.ref}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
