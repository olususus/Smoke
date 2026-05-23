"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGit } from "../context/GitContext";
import { ChevronDown, Download, LogOut, Loader2, Lock, Globe, BookOpen, Plus, X, GitPullRequest } from "lucide-react";
import { searchReviewRequestedPrs } from "@/lib/github-pulls";
import { openExternalUrl } from "@/lib/open-external";
import { clearAuth } from "@/lib/auth";
import { fetchGitHubUser, type GitHubUser } from "@/lib/github-user";
import {
  pickAndAddExistingRepository,
  removeRecentRepository,
  saveRecentRepository,
} from "@/lib/open-repo";
import { CloneRepositoryDialog, type RemoteRepo } from "../components/CloneRepositoryDialog";
import { CreateRepositoryDialog } from "../components/CreateRepositoryDialog";
import { NeuralBackdrop } from "../components/NeuralBackdrop";
import { AppMenubar } from "../components/AppMenubar";
import { BetaBanner } from "../components/BetaBanner";
import { DropdownPortal } from "../components/DropdownPortal";
import {
  HomeActionCards,
  HomeActionMenuItems,
  type HomeRepoActionId,
} from "../components/HomeRepoActions";

interface LocalRepo {
  path: string;
  name: string;
}

function DashboardPage() {
  const git = useGit();
  const router = useRouter();
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [filter, setFilter] = useState("");
  const [remoteRepos, setRemoteRepos] = useState<RemoteRepo[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [localRepos, setLocalRepos] = useState<LocalRepo[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneInitial, setCloneInitial] = useState<RemoteRepo | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<HomeRepoActionId | null>(null);
  const [reviewPrs, setReviewPrs] = useState<
    { number: number; title: string; repository_url: string; html_url: string }[]
  >([]);

  useEffect(() => {
    void fetchGitHubUser().then((u) => {
      setUser(u);
      if (u?.login) {
        void searchReviewRequestedPrs(u.login)
          .then(setReviewPrs)
          .catch(() => setReviewPrs([]));
      }
    });
    try {
      const stored = localStorage.getItem("smoke_recent_repos");
      if (stored) setLocalRepos(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const loadRemoteRepos = useCallback(async () => {
    setLoadingRemote(true);
    try {
      const { githubApiFetch } = await import("@/lib/github-api");
      const data = await githubApiFetch<RemoteRepo[]>(
        "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member"
      );
      if (Array.isArray(data)) setRemoteRepos(data);
    } catch {
      /* ignore */
    } finally {
      setLoadingRemote(false);
    }
  }, []);

  useEffect(() => {
    void loadRemoteRepos();
  }, [loadRemoteRepos]);

  const refreshLocalRepos = useCallback(() => {
    try {
      const stored = localStorage.getItem("smoke_recent_repos");
      if (stored) setLocalRepos(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const openLocalRepo = async (path: string, name: string) => {
    setLoading(true);
    setErrorMsg("");
    try {
      saveRecentRepository(path, name);
      refreshLocalRepos();
      await git.openRepo(path);
      router.push("/repo");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddExisting = async () => {
    setAddOpen(false);
    setErrorMsg("");
    setLoading(true);
    try {
      const result = await pickAndAddExistingRepository();
      if (!result.ok) {
        if (result.error) setErrorMsg(result.error);
        return;
      }
      await openLocalRepo(result.path, result.name);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async (path: string) => {
    const name = path.split("/").filter(Boolean).pop() || path;
    await openLocalRepo(path, name);
  };

  const openCreateDialog = () => {
    setAddOpen(false);
    setCreateOpen(true);
  };

  const handleSignOut = async () => {
    await clearAuth();
    window.location.href = "/";
  };

  const q = filter.trim().toLowerCase();

  const filteredLocal = useMemo(
    () =>
      localRepos.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.path.toLowerCase().includes(q)
      ),
    [localRepos, q]
  );

  const filteredRemote = useMemo(
    () =>
      remoteRepos.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          (r.description?.toLowerCase().includes(q) ?? false)
      ),
    [remoteRepos, q]
  );

  const remoteByOwner = useMemo(() => {
    const map = new Map<string, RemoteRepo[]>();
    for (const repo of filteredRemote) {
      const owner = repo.full_name.split("/")[0] || "other";
      if (!map.has(owner)) map.set(owner, []);
      map.get(owner)!.push(repo);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRemote]);

  const openCloneModal = (repo?: RemoteRepo) => {
    setAddOpen(false);
    setCloneInitial(repo ?? null);
    setCloneOpen(true);
  };

  const runRepoAction = async (id: HomeRepoActionId) => {
    setAddOpen(false);
    if (id === "clone") {
      openCloneModal();
      return;
    }
    if (id === "create") {
      openCreateDialog();
      return;
    }
    setLoadingAction("add");
    try {
      await handleAddExisting();
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="gh-home">
      <AppMenubar
        variant="home"
        actions={{
          onCloneRepository: () => openCloneModal(),
          onCreateRepository: () => openCreateDialog(),
          onAddLocalRepo: () => void handleAddExisting(),
          onSignOut: () => void handleSignOut(),
        }}
      />
      <BetaBanner />
      <div className="gh-home-body">
        <aside className="ghd-repo-pane">
          <div className="ghd-user-row">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="ghd-user-avatar" />
            ) : (
              <div
                className="ghd-user-avatar"
                style={{
                  background: "var(--gh-panel-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                }}
              >
                ?
              </div>
            )}
            <div className="ghd-user-meta">
              <div className="ghd-user-login">{user?.login ? `@${user.login}` : "Signed in"}</div>
              <div className="ghd-user-sub">{user?.name || "GitHub account"}</div>
            </div>
            <button type="button" className="ghd-icon-btn" onClick={handleSignOut} title="Sign out">
              <LogOut size={14} />
            </button>
          </div>

          <div className="ghd-toolbar-row">
            <input
              className="ghd-filter-input"
              placeholder="Filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button
              ref={addBtnRef}
              type="button"
              className={`ghd-add-trigger${addOpen ? " ghd-add-trigger--open" : ""}`}
              onClick={() => setAddOpen((o) => !o)}
              aria-expanded={addOpen}
              aria-haspopup="menu"
              title="Add repository"
            >
              <Plus size={15} strokeWidth={2.25} />
              <span className="ghd-add-trigger__label">Add</span>
              <ChevronDown size={14} className="ghd-add-trigger__chevron" aria-hidden />
            </button>
            <DropdownPortal
              open={addOpen}
              onClose={() => setAddOpen(false)}
              anchorRef={addBtnRef}
              align="end"
              minWidth={268}
            >
              <div className="gh-home-menu">
                <div className="gh-home-menu__header">Add repository</div>
                <HomeActionMenuItems
                  onPick={() => setAddOpen(false)}
                  onAction={(id) => void runRepoAction(id)}
                />
              </div>
            </DropdownPortal>
          </div>

          <div className="ghd-repo-scroll">
            {filteredLocal.length > 0 && (
              <div className="ghd-repo-group">
                <div className="ghd-repo-group-title">Recent on this computer</div>
                {filteredLocal.map((repo) => (
                  <button
                    key={repo.path}
                    type="button"
                    className="ghd-repo-row"
                    onClick={() => handleOpen(repo.path)}
                    disabled={loading}
                  >
                    <BookOpen size={14} className="ghd-repo-icon" />
                    <span className="ghd-repo-row-name">{repo.name}</span>
                    <span
                      className="ghd-repo-row-action"
                      role="button"
                      tabIndex={0}
                      title="Remove from list"
                      aria-label={`Remove ${repo.name} from recent list`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeRecentRepository(repo.path);
                        refreshLocalRepos();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          removeRecentRepository(repo.path);
                          refreshLocalRepos();
                        }
                      }}
                    >
                      <X size={12} />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {loadingRemote && remoteRepos.length === 0 ? (
              <div className="ghd-list-empty">
                <Loader2 size={18} className="animate-spin" />
                <span>Loading repositories…</span>
              </div>
            ) : (
              remoteByOwner.map(([owner, repos]) => (
                <div key={owner} className="ghd-repo-group">
                  <div className="ghd-repo-group-title">{owner}</div>
                  {repos.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      className="ghd-repo-row"
                      onClick={() => openCloneModal(repo)}
                    >
                      {repo.private ? (
                        <Lock size={14} className="ghd-repo-icon" />
                      ) : (
                        <Globe size={14} className="ghd-repo-icon" />
                      )}
                      <span className="ghd-repo-row-name">{repo.name}</span>
                      <Download size={12} className="ghd-repo-row-action" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="ghd-welcome-pane neural-welcome">
          <NeuralBackdrop variant="subtle" />
          <div className="neural-welcome__content">
            <h2>
              Welcome to <span className="text-aero-accent">Smoke</span>
            </h2>
            <p>Clone from GitHub, add a folder on this machine, or pick a repo from the list.</p>

            {reviewPrs.length > 0 && (
              <section className="dashboard-review-prs">
                <h3>
                  <GitPullRequest size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Awaiting your review
                </h3>
                <ul>
                  {reviewPrs.slice(0, 8).map((pr) => (
                    <li key={pr.html_url}>
                      <button
                        type="button"
                        className="dashboard-review-prs__item"
                        onClick={() => void openExternalUrl(pr.html_url)}
                      >
                        <span className="dashboard-review-prs__title">{pr.title}</span>
                        <span className="dashboard-review-prs__meta">
                          {pr.repository_url.split("/").slice(-2).join("/")} #{pr.number}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <HomeActionCards
              onAction={(id) => void runRepoAction(id)}
              loadingId={loadingAction}
              disabled={loading && loadingAction == null}
            />
            {errorMsg && (
              <div className="login-error" style={{ marginTop: 16, maxWidth: 400 }}>
                {errorMsg}
              </div>
            )}
          </div>
        </main>
      </div>

      <CloneRepositoryDialog
        open={cloneOpen}
        onClose={() => {
          setCloneOpen(false);
          setCloneInitial(null);
        }}
        initialRepo={cloneInitial}
        onCloned={(path, name) => {
          saveRecentRepository(path, name);
          refreshLocalRepos();
          void git.openRepo(path).then(() => {
            router.push("/repo");
          });
        }}
      />

      <CreateRepositoryDialog
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSuccess={(path, name) => {
          saveRecentRepository(path, name);
          refreshLocalRepos();
          void loadRemoteRepos();
          void git.openRepo(path).then(() => {
            router.push("/repo");
          });
        }}
      />
    </div>
  );
}

export default DashboardPage;
