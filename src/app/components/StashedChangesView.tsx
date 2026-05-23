"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ChevronLeft, Loader2 } from "lucide-react";
import { useGit, type StashEntry } from "../context/GitContext";
import { confirmApp } from "@/lib/app-dialog";
import { DiffViewer } from "./DiffViewer";
import type { DiffResult } from "../context/GitContext";

function statusDotClass(status: string): string {
  if (status === "added" || status === "untracked") return "gh-status-dot--added";
  if (status === "deleted") return "gh-status-dot--deleted";
  return "gh-status-dot--modified";
}

interface Props {
  stashIndex?: number;
  onBack: () => void;
  onRestored?: () => void;
}

export function StashedChangesView({ stashIndex = 0, onBack, onRestored }: Props) {
  const git = useGit();
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(stashIndex);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadStashes = useCallback(async () => {
    const list = await git.stashList();
    setStashes(list);
    if (list.length === 0) {
      onBack();
      return;
    }
    if (!list.some((s) => s.index === activeIndex)) {
      setActiveIndex(list[0].index);
    }
  }, [git, activeIndex, onBack]);

  useEffect(() => {
    void loadStashes();
  }, [loadStashes, git.repoPath]);

  useEffect(() => {
    if (stashes.length === 0) return;
    let cancelled = false;
    setLoading(true);
    void git
      .getStashDiff(activeIndex)
      .then((d) => {
        if (cancelled) return;
        setDiff(d);
        setSelectedFile(d.files[0]?.path ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setDiff(null);
          setSelectedFile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeIndex, git, stashes.length]);

  const filteredDiff = useMemo(() => {
    if (!diff || !selectedFile) return null;
    return {
      ...diff,
      files: diff.files.filter((f) => f.path === selectedFile),
    };
  }, [diff, selectedFile]);

  const activeStash = stashes.find((s) => s.index === activeIndex);

  const handleDiscard = async () => {
    if (
      !(await confirmApp("Discard this stash? The stashed changes cannot be recovered."))
    ) {
      return;
    }
    setBusy(true);
    try {
      await git.stashDrop(activeIndex);
      await loadStashes();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      await git.stashApply(activeIndex);
      onRestored?.();
      onBack();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gh-stash-view">
      <header className="gh-stash-view__header">
        <button type="button" className="gh-stash-view__back" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden />
          Changes
        </button>
        <h2 className="gh-stash-view__title">Stashed changes</h2>
        <div className="gh-stash-view__actions">
          <button
            type="button"
            className="gh-stash-view__btn gh-stash-view__btn--ghost"
            disabled={busy}
            onClick={() => void handleDiscard()}
          >
            Discard
          </button>
          <button
            type="button"
            className="gh-stash-view__btn gh-stash-view__btn--primary"
            disabled={busy}
            onClick={() => void handleRestore()}
          >
            Restore
          </button>
        </div>
        <p className="gh-stash-view__hint">
          Restore will move your stashed files to the Changes list.
        </p>
      </header>

      {stashes.length > 1 && (
        <div className="gh-stash-view__picker">
          {stashes.map((s) => (
            <button
              key={s.index}
              type="button"
              className={`gh-stash-view__stash-pill${s.index === activeIndex ? " gh-stash-view__stash-pill--active" : ""}`}
              onClick={() => setActiveIndex(s.index)}
            >
              {s.message.replace(/^WIP on[^:]+:\s*/, "").slice(0, 40) || `Stash ${s.index}`}
            </button>
          ))}
        </div>
      )}

      {activeStash && (
        <p className="gh-stash-view__stash-label">
          <Archive size={14} aria-hidden />
          {activeStash.message}
        </p>
      )}

      <div className="gh-stash-view__body">
        <aside className="gh-stash-view__files">
          {loading ? (
            <div className="gh-empty-state">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : !diff || diff.files.length === 0 ? (
            <div className="gh-empty-state">No file changes in this stash</div>
          ) : (
            diff.files.map((f) => (
              <button
                key={f.path}
                type="button"
                className={`gh-file-row${selectedFile === f.path ? " gh-file-row--selected" : ""}`}
                style={{ width: "100%", border: "none", fontFamily: "inherit" }}
                onClick={() => setSelectedFile(f.path)}
              >
                <span className={`gh-status-dot ${statusDotClass(f.status)}`} />
                <span className="gh-file-path">{f.path}</span>
              </button>
            ))
          )}
        </aside>
        <main className="gh-stash-view__diff gh-diff-pane">
          {selectedFile && filteredDiff ? (
            <DiffViewer diff={filteredDiff} />
          ) : (
            <div className="gh-empty-state">Select a file to view its diff</div>
          )}
        </main>
      </div>
    </div>
  );
}
