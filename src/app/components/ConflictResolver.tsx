"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useGit, type ConflictDetail } from "../context/GitContext";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  filePath: string;
}

export function ConflictResolver({ filePath }: Props) {
  const git = useGit();
  const [detail, setDetail] = useState<ConflictDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState("");
  const [view, setView] = useState<"working" | "ours" | "theirs" | "base">("working");

  const load = useCallback(async () => {
    if (!git.repoPath) return;
    setLoading(true);
    try {
      const d = await git.getConflictDetail(filePath);
      setDetail(d);
      setManual(d.working || d.ours || d.theirs);
      setView("working");
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [git, filePath]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (resolution: "ours" | "theirs" | "manual") => {
    setSaving(true);
    try {
      await git.resolveConflict(
        filePath,
        resolution,
        resolution === "manual" ? manual : undefined
      );
      await git.refreshAll();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="gh-empty-state">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="gh-empty-state">
        <AlertTriangle size={20} style={{ color: "var(--danger)", marginBottom: 8 }} />
        Could not load conflict details for {filePath}
      </div>
    );
  }

  const preview =
    view === "ours"
      ? detail.ours
      : view === "theirs"
        ? detail.theirs
        : view === "base"
          ? detail.base ?? ""
          : detail.working;

  return (
    <div className="conflict-resolver">
      <div className="conflict-resolver__banner">
        <AlertTriangle size={16} />
        <span>
          Merge conflict in <strong>{filePath}</strong>
        </span>
      </div>

      <div className="conflict-resolver__actions">
        <button
          type="button"
          className="gh-btn gh-btn--secondary"
          disabled={saving}
          onClick={() => void resolve("ours")}
        >
          Use ours (current branch)
        </button>
        <button
          type="button"
          className="gh-btn gh-btn--secondary"
          disabled={saving}
          onClick={() => void resolve("theirs")}
        >
          Use theirs (incoming)
        </button>
        <button
          type="button"
          className="gh-btn gh-btn--primary"
          disabled={saving || !manual.trim()}
          onClick={() => void resolve("manual")}
        >
          {saving ? "Saving…" : "Save edited resolution"}
        </button>
        <button
          type="button"
          className="gh-btn gh-btn--ghost"
          disabled={saving}
          onClick={() => void git.abortMerge()}
        >
          Abort merge
        </button>
      </div>

      <div className="conflict-resolver__tabs">
        {(["working", "ours", "theirs", "base"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`conflict-resolver__tab${view === tab ? " conflict-resolver__tab--active" : ""}`}
            onClick={() => {
              setView(tab);
              if (tab !== "base") {
                const text =
                  tab === "working"
                    ? detail.working
                    : tab === "ours"
                      ? detail.ours
                      : detail.theirs;
                setManual(text);
              }
            }}
          >
            {tab === "working" ? "Working copy" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {view === "working" ? (
        <textarea
          className="conflict-resolver__editor"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <pre className="conflict-resolver__preview">{preview || "(empty)"}</pre>
      )}
    </div>
  );
}
