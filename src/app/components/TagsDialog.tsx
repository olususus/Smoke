"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Tag, X, Plus, Trash2, Loader2, Upload } from "lucide-react";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useSettings } from "../context/SettingsContext";
import { PromptDialog } from "./PromptDialog";
import { ConfirmDialog } from "./PromptDialog";
import { parseGitHubRemote } from "@/lib/github-url";

interface TagInfo {
  name: string;
  target: string;
  message: string | null;
}

interface Props {
  open: boolean;
  repoPath: string | null;
  remoteUrl?: string | null;
  onClose: () => void;
  onMessage?: (message: string) => void;
}

export function TagsDialog({ open, repoPath, remoteUrl, onClose, onMessage }: Props) {
  const { motionDurationMs } = useSettings();
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [deleteName, setDeleteName] = useState<string | null>(null);
  const [pushingTag, setPushingTag] = useState<string | null>(null);

  const gh = parseGitHubRemote(remoteUrl ?? null);

  const load = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const list = await invoke<TagInfo[]>("list_tags", { repoPath });
      setTags(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onMessage?.(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  }, [repoPath, onMessage]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const pushTagToOrigin = async (name: string) => {
    if (!repoPath) return;
    setPushingTag(name);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("push_tag", { repoPath, name });
      const releaseHint = name.startsWith("v")
        ? " GitHub Actions will build Linux installers and attach them to the release (usually 5–10 minutes)."
        : "";
      onMessage?.(`Pushed tag ${name} to origin.${releaseHint}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onMessage?.(msg);
      alert(msg);
    } finally {
      setPushingTag(null);
    }
  };

  const createAndMaybePushTag = async (
    name: string,
    message: string | null,
    pushToOrigin: boolean
  ) => {
    if (!name || !repoPath) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("create_tag", { repoPath, name, message });
      if (pushToOrigin) {
        await pushTagToOrigin(name);
      } else {
        onMessage?.(`Created tag ${name} locally.`);
      }
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onMessage?.(msg);
      alert(msg);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <div
        className={`aero-modal-backdrop${visible ? " aero-modal-backdrop--visible" : ""}`}
        onClick={onClose}
        role="presentation"
      >
        <div
          className={`aero-modal${visible ? " aero-modal--visible" : ""}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 520, maxHeight: "70vh", display: "flex", flexDirection: "column" }}
        >
          <header className="aero-modal__header">
            <div className="aero-modal__title-row">
              <Tag size={18} style={{ color: "var(--aero-sky)" }} />
              <h2>Tags</h2>
            </div>
            <button type="button" className="ghd-icon-btn" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </header>

          <div style={{ padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 12 }}
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={14} /> Create tag
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              disabled={!remoteUrl}
              title={remoteUrl ? undefined : "Add a GitHub remote to push release tags"}
              onClick={() => setReleaseOpen(true)}
            >
              <Upload size={14} /> Release tag &amp; push
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12, marginLeft: "auto" }}
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>

          {gh && (
            <p className="ghd-hint" style={{ margin: "0 16px 8px" }}>
              Tags starting with <code>v</code> (e.g. <code>v0.1.0</code>) trigger the release workflow
              on {gh.owner}/{gh.repo} and attach .deb, .rpm, and AppImage builds.
            </p>
          )}

          <ul style={{ flex: 1, overflow: "auto", margin: 0, padding: "0 8px 16px", listStyle: "none" }}>
            {loading && (
              <li className="gh-empty-state" style={{ minHeight: 60 }}>
                <Loader2 size={18} className="animate-spin" />
              </li>
            )}
            {!loading && tags.length === 0 && (
              <li className="gh-empty-state" style={{ minHeight: 60, fontSize: 13 }}>
                No tags yet
              </li>
            )}
            {tags.map((t) => (
              <li
                key={t.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 8px",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-jetbrains)" }}>
                    {t.target}
                    {t.message ? ` — ${t.message}` : ""}
                  </div>
                </div>
                {remoteUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "4px 8px" }}
                    title="Push tag to origin"
                    disabled={pushingTag === t.name}
                    onClick={() => void pushTagToOrigin(t.name)}
                  >
                    {pushingTag === t.name ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    Push
                  </button>
                )}
                <button
                  type="button"
                  className="ghd-icon-btn"
                  title="Delete tag"
                  onClick={() => setDeleteName(t.name)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <PromptDialog
        open={createOpen}
        title="Create tag"
        label="Tag name"
        confirmLabel="Create"
        onClose={() => setCreateOpen(false)}
        onConfirm={async (name) => {
          setCreateOpen(false);
          if (!name || !repoPath) return;
          const message = window.prompt("Tag message (optional, leave empty for lightweight tag):");
          if (message === null) return;
          await createAndMaybePushTag(name, message.trim() || null, false);
        }}
      />

      <PromptDialog
        open={releaseOpen}
        title="Release tag & push"
        label="Tag name (use v0.1.0 style for CI releases)"
        defaultValue="v0.1.0"
        confirmLabel="Create & push"
        onClose={() => setReleaseOpen(false)}
        onConfirm={async (name) => {
          setReleaseOpen(false);
          if (!name || !repoPath) return;
          const trimmed = name.trim();
          if (!trimmed) return;
          const message = window.prompt("Release notes (optional):", `Release ${trimmed}`);
          if (message === null) return;
          await createAndMaybePushTag(trimmed, message.trim() || `Release ${trimmed}`, true);
        }}
      />

      <ConfirmDialog
        open={!!deleteName}
        title="Delete tag"
        message={`Delete tag "${deleteName}"? This only removes the local tag.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteName(null)}
        onConfirm={async () => {
          if (!deleteName || !repoPath) return;
          const name = deleteName;
          setDeleteName(null);
          try {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("delete_tag", { repoPath, name });
            await load();
            onMessage?.(`Deleted tag ${name}.`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            onMessage?.(msg);
            alert(msg);
          }
        }}
      />
    </>
  );
}
