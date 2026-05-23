"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Settings, X, Plus, Trash2 } from "lucide-react";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useSettings } from "../context/SettingsContext";
import { confirmApp } from "@/lib/app-dialog";

interface RemoteInfo {
  name: string;
  url: string;
}

interface Props {
  open: boolean;
  repoPath: string | null;
  onClose: () => void;
  onRemotesChanged?: () => void;
}

export function RepositorySettingsDialog({
  open,
  repoPath,
  onClose,
  onRemotesChanged,
}: Props) {
  const { motionDurationMs } = useSettings();
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!repoPath) return;
    const { invoke } = await import("@tauri-apps/api/core");
    const list = await invoke<RemoteInfo[]>("get_remotes", { repoPath });
    setRemotes(list);
    setEditing(Object.fromEntries(list.map((r) => [r.name, r.url])));
  }, [repoPath]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const invokeGit = async (cmd: string, args: Record<string, unknown>) => {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(cmd, { repoPath, ...args });
    await load();
    onRemotesChanged?.();
  };

  if (!mounted) return null;

  return (
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
        style={{ maxWidth: 520 }}
      >
        <header className="aero-modal__header">
          <div className="aero-modal__title-row">
            <Settings size={18} style={{ color: "var(--aero-sky)" }} />
            <h2>Repository settings</h2>
          </div>
          <button type="button" className="ghd-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="aero-modal__body" style={{ padding: "8px 16px 16px" }}>
          <h3 className="aero-settings__label">Remotes</h3>
          {remotes.map((r) => (
            <div key={r.name} className="repo-settings-remote">
              <span className="repo-settings-remote__name">{r.name}</span>
              <input
                className="ghd-filter-input"
                style={{ flex: 1, fontSize: 12 }}
                value={editing[r.name] ?? r.url}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, [r.name]: e.target.value }))
                }
              />
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() =>
                  void invokeGit("set_remote_url", { name: r.name, url: editing[r.name] })
                }
              >
                Save
              </button>
              {r.name !== "origin" && (
                <button
                  type="button"
                  className="ghd-icon-btn"
                  title="Remove remote"
                  onClick={() => {
                    void (async () => {
                      if (await confirmApp(`Remove remote "${r.name}"?`)) {
                        await invokeGit("remove_remote", { name: r.name });
                      }
                    })();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}

          <div className="repo-settings-add">
            <input
              className="ghd-filter-input"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ width: 100 }}
            />
            <input
              className="ghd-filter-input"
              placeholder="URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (!newName.trim() || !newUrl.trim()) return;
                void invokeGit("add_remote", { name: newName.trim(), url: newUrl.trim() }).then(
                  () => {
                    setNewName("");
                    setNewUrl("");
                  }
                );
              }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
