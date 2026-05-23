"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, RefreshCw, Loader2, Lock, Globe } from "lucide-react";
import { githubApiFetch } from "@/lib/github-api";
import { isSignedIn } from "@/lib/auth";

export interface RemoteRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  clone_url: string;
  description: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCloned: (path: string, name: string) => void;
  initialRepo?: RemoteRepo | null;
}

export function CloneRepositoryDialog({ open, onClose, onCloned, initialRepo }: Props) {
  const [repos, setRepos] = useState<RemoteRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<RemoteRepo | null>(null);
  const [localPath, setLocalPath] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [error, setError] = useState("");
  const [cloning, setCloning] = useState(false);
  const [tab, setTab] = useState<"github" | "url">("github");

  const loadRepos = async () => {
    setLoading(true);
    setError("");
    try {
      if (!(await isSignedIn())) {
        setError("Not signed in to GitHub.");
        return;
      }
      const data = await githubApiFetch<RemoteRepo[]>(
        "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member"
      );
      setRepos(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load repositories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab("github");
    setFilter("");
    setError("");
    if (initialRepo) {
      setSelected(initialRepo);
      setCloneUrl(initialRepo.clone_url);
    } else {
      setSelected(null);
      setCloneUrl("");
    }
    void loadRepos();
  }, [open, initialRepo]);

  useEffect(() => {
    if (open) setLocalPath("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false)
    );
  }, [repos, filter]);

  const handleChoosePath = async () => {
    try {
      const { open: pick } = await import("@tauri-apps/plugin-dialog");
      const dir = await pick({ directory: true, title: "Clone to…" });
      if (dir && typeof dir === "string") setLocalPath(dir);
    } catch {
      /* ignore */
    }
  };

  const handleClone = async () => {
    const url = tab === "url" ? cloneUrl.trim() : selected?.clone_url ?? cloneUrl.trim();
    if (!url || !localPath.trim()) {
      setError("Pick a repository and local path.");
      return;
    }
    setCloning(true);
    setError("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const repoName =
        selected?.name ||
        url
          .split("/")
          .filter(Boolean)
          .pop()
          ?.replace(/\.git$/, "") ||
        "repository";
      const dest = localPath.endsWith("/") ? `${localPath}${repoName}` : `${localPath}/${repoName}`;
      await invoke("clone_repo", { url, destPath: dest });
      onCloned(dest, repoName);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setCloning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="ghd-modal-backdrop" onClick={onClose}>
      <div className="ghd-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ghd-modal-header">
          <h2>Clone a repository</h2>
          <button type="button" className="ghd-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="ghd-modal-tabs">
          <button
            type="button"
            className={`ghd-modal-tab${tab === "github" ? " ghd-modal-tab--active" : ""}`}
            onClick={() => setTab("github")}
          >
            GitHub.com
          </button>
          <button
            type="button"
            className={`ghd-modal-tab${tab === "url" ? " ghd-modal-tab--active" : ""}`}
            onClick={() => setTab("url")}
          >
            URL
          </button>
        </div>

        <div className="ghd-modal-body">
          {tab === "github" ? (
            <>
              <div className="ghd-filter-row">
                <input
                  className="ghd-filter-input"
                  placeholder="Filter your repositories"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <button type="button" className="ghd-icon-btn" onClick={loadRepos} title="Refresh">
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
              <div className="ghd-modal-repo-list">
                {loading ? (
                  <div className="ghd-list-empty">
                    <Loader2 size={20} className="animate-spin" />
                    <span>Loading repositories…</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="ghd-list-empty">No repositories match</div>
                ) : (
                  filtered.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      className={`ghd-repo-row${selected?.id === repo.id ? " ghd-repo-row--selected" : ""}`}
                      onClick={() => {
                        setSelected(repo);
                        setCloneUrl(repo.clone_url);
                      }}
                    >
                      {repo.private ? (
                        <Lock size={14} className="ghd-repo-icon" />
                      ) : (
                        <Globe size={14} className="ghd-repo-icon" />
                      )}
                      <span className="ghd-repo-row-name">{repo.full_name}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="ghd-form-stack">
              <label className="ghd-label">Repository URL</label>
              <input
                className="ghd-filter-input"
                value={cloneUrl}
                onChange={(e) => setCloneUrl(e.target.value)}
                placeholder="https://github.com/owner/repo.git"
              />
            </div>
          )}

          <div className="ghd-form-stack" style={{ marginTop: 12 }}>
            <label className="ghd-label">Local path</label>
            <div className="ghd-path-row">
              <input
                className="ghd-filter-input"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
              />
              <button type="button" className="btn btn-ghost" onClick={handleChoosePath}>
                Choose…
              </button>
            </div>
          </div>

          {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}
        </div>

        <footer className="ghd-modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="gh-commit-btn"
            style={{ width: "auto", padding: "8px 20px" }}
            disabled={cloning || (!cloneUrl.trim() && !selected)}
            onClick={handleClone}
          >
            {cloning ? <Loader2 size={14} className="animate-spin" /> : "Clone"}
          </button>
        </footer>
      </div>
    </div>
  );
}
