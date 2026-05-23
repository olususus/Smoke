"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Loader2, Lock, Globe, FolderOpen } from "lucide-react";
import { isSignedIn } from "@/lib/auth";
import { fetchGitHubUser } from "@/lib/github-user";
import {
  listGitignoreTemplates,
  listLicenses,
  listUserOrgs,
  validateRepoName,
  type GitHubLicense,
  type GitHubOrg,
} from "@/lib/github-repos";
import {
  createLocalAndPublishOnGitHub,
  publishExistingRepoToGitHub,
  resolveCreateLocalPath,
} from "@/lib/create-github-repo";

export type CreateRepositoryDialogMode = "create" | "publish";

interface Props {
  open: boolean;
  mode: CreateRepositoryDialogMode;
  onClose: () => void;
  onSuccess: (path: string, name: string) => void;
  repoPath?: string | null;
  defaultName?: string;
}

export function CreateRepositoryDialog({
  open,
  mode,
  onClose,
  onSuccess,
  repoPath,
  defaultName = "",
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [ownerLogin, setOwnerLogin] = useState("");
  const [userLogin, setUserLogin] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [gitignore, setGitignore] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [initReadme, setInitReadme] = useState(true);
  const [orgs, setOrgs] = useState<GitHubOrg[]>([]);
  const [gitignores, setGitignores] = useState<string[]>([]);
  const [licenses, setLicenses] = useState<GitHubLicense[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const localPathPreview = useMemo(() => {
    if (mode !== "create" || !parentPath.trim() || !name.trim()) return "";
    const sep = parentPath.includes("\\") ? "\\" : "/";
    const base = parentPath.replace(/[/\\]+$/, "");
    return `${base}${sep}${name.trim()}`;
  }, [mode, parentPath, name]);

  const loadMeta = async () => {
    setLoadingMeta(true);
    setError("");
    try {
      if (!(await isSignedIn())) {
        setError("Sign in to GitHub first.");
        return;
      }
      const user = await fetchGitHubUser();
      if (!user) {
        setError("Could not load GitHub profile.");
        return;
      }
      setUserLogin(user.login);
      setOwnerLogin((prev) => prev || user.login);
      const [orgList, templates, licenseList] = await Promise.all([
        listUserOrgs(),
        mode === "create" ? listGitignoreTemplates() : Promise.resolve([]),
        mode === "create" ? listLicenses() : Promise.resolve([]),
      ]);
      setOrgs(orgList);
      setGitignores(templates);
      setLicenses(licenseList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load GitHub data");
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setDescription("");
    setParentPath("");
    setIsPrivate(false);
    setGitignore("");
    setLicenseKey("");
    setInitReadme(true);
    setError("");
    setSubmitting(false);
    void loadMeta();
  }, [open, defaultName, mode]);

  const handleChooseParent = async () => {
    const { open: pick } = await import("@tauri-apps/plugin-dialog");
    const selected = await pick({ directory: true, title: "Create repository in folder" });
    if (selected && typeof selected === "string") setParentPath(selected);
  };

  const handleSubmit = async () => {
    const nameErr = validateRepoName(name);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    if (!ownerLogin || !userLogin) {
      setError("Sign in to GitHub first.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      if (mode === "create") {
        const localPath = resolveCreateLocalPath(parentPath, name);
        const result = await createLocalAndPublishOnGitHub({
          name: name.trim(),
          description: description.trim(),
          localPath,
          ownerLogin,
          userLogin,
          isPrivate,
          gitignoreTemplate: gitignore || null,
          licenseKey: licenseKey || null,
          initReadme,
        });
        onSuccess(result.repoPath, name.trim());
        onClose();
      } else {
        if (!repoPath) {
          setError("No repository open.");
          return;
        }
        const result = await publishExistingRepoToGitHub({
          repoPath,
          name: name.trim(),
          description: description.trim(),
          ownerLogin,
          userLogin,
          isPrivate,
        });
        onSuccess(result.repoPath, name.trim());
        onClose();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create repository");
    } finally {
      setSubmitting(false);
    }
  };

  const owners = useMemo(() => {
    const list: { login: string; label: string }[] = [];
    if (userLogin) list.push({ login: userLogin, label: userLogin });
    for (const o of orgs) {
      if (o.login !== userLogin) list.push({ login: o.login, label: o.login });
    }
    return list;
  }, [userLogin, orgs]);

  if (!open) return null;

  const title = mode === "create" ? "Create a new repository" : "Publish repository";
  const submitLabel = mode === "create" ? "Create repository" : "Publish repository";

  return (
    <div className="ghd-modal-backdrop" onClick={onClose}>
      <div className="ghd-modal ghd-modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="ghd-modal-header">
          <h2>{title}</h2>
          <button type="button" className="ghd-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="ghd-modal-body ghd-modal-body--scroll">
          {loadingMeta && !userLogin ? (
            <div className="ghd-list-empty">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading…</span>
            </div>
          ) : (
            <div className="ghd-form-stack">
              <div className="ghd-form-row">
                <div className="ghd-form-stack" style={{ flex: 1 }}>
                  <label className="ghd-label">Name</label>
                  <input
                    className="ghd-filter-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="my-project"
                    autoFocus
                  />
                </div>
                <div className="ghd-form-stack" style={{ minWidth: 140 }}>
                  <label className="ghd-label">Owner</label>
                  <select
                    className="ghd-filter-input"
                    value={ownerLogin}
                    onChange={(e) => setOwnerLogin(e.target.value)}
                  >
                    {owners.map((o) => (
                      <option key={o.login} value={o.login}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ghd-form-stack">
                <label className="ghd-label">Description</label>
                <input
                  className="ghd-filter-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="ghd-form-stack">
                <span className="ghd-label">Visibility</span>
                <div className="ghd-visibility-row">
                  <button
                    type="button"
                    className={`ghd-visibility-btn${!isPrivate ? " ghd-visibility-btn--active" : ""}`}
                    onClick={() => setIsPrivate(false)}
                  >
                    <Globe size={14} />
                    Public
                  </button>
                  <button
                    type="button"
                    className={`ghd-visibility-btn${isPrivate ? " ghd-visibility-btn--active" : ""}`}
                    onClick={() => setIsPrivate(true)}
                  >
                    <Lock size={14} />
                    Private
                  </button>
                </div>
              </div>

              {mode === "create" && (
                <>
                  <div className="ghd-form-stack">
                    <label className="ghd-label">Local path</label>
                    <div className="ghd-path-row">
                      <input
                        className="ghd-filter-input"
                        value={parentPath}
                        onChange={(e) => setParentPath(e.target.value)}
                        placeholder="Parent folder"
                      />
                      <button type="button" className="btn btn-ghost" onClick={() => void handleChooseParent()}>
                        Choose…
                      </button>
                    </div>
                    {localPathPreview && (
                      <p className="ghd-hint">
                        <FolderOpen size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                        {localPathPreview}
                      </p>
                    )}
                  </div>

                  <div className="ghd-form-row">
                    <div className="ghd-form-stack" style={{ flex: 1 }}>
                      <label className="ghd-label">Git ignore</label>
                      <select
                        className="ghd-filter-input"
                        value={gitignore}
                        onChange={(e) => setGitignore(e.target.value)}
                      >
                        <option value="">None</option>
                        {gitignores.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="ghd-form-stack" style={{ flex: 1 }}>
                      <label className="ghd-label">License</label>
                      <select
                        className="ghd-filter-input"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                      >
                        <option value="">None</option>
                        {licenses.map((l) => (
                          <option key={l.key} value={l.key}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="ghd-check-row">
                    <input
                      type="checkbox"
                      checked={initReadme}
                      onChange={(e) => setInitReadme(e.target.checked)}
                    />
                    Initialize this repository with a README
                  </label>
                </>
              )}

              {mode === "publish" && repoPath && (
                <p className="ghd-hint">Publishing from: {repoPath}</p>
              )}
            </div>
          )}

          {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}
        </div>

        <footer className="ghd-modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="gh-commit-btn"
            style={{ width: "auto", padding: "8px 20px" }}
            disabled={submitting || !name.trim() || (mode === "create" && !parentPath.trim())}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : submitLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
