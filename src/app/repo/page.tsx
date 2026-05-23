"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useGit } from "../context/GitContext";
import { CommitHistoryList } from "../components/CommitHistoryList";
import { ChangesCleanState } from "../components/ChangesCleanState";
import { ChangesSidebarEmpty } from "../components/ChangesSidebarEmpty";
import { DiffViewer, type DiffScrollTarget } from "../components/DiffViewer";
import { SecretsDialog } from "../components/SecretsDialog";
import type { SecretFinding } from "@/lib/collect-secrets";
import { collectSecretsFromDiffs } from "@/lib/collect-secrets";
import { useSettings } from "../context/SettingsContext";
import {
  Loader2, FolderOpen, ChevronDown,
  Folder, Square, CheckSquare, RotateCcw, AlertTriangle,
} from "lucide-react";
import { ConflictResolver } from "../components/ConflictResolver";
import { clearAuth } from "@/lib/auth";
import { AppMenubar } from "../components/AppMenubar";
import { useRepoMenuActions } from "../hooks/useRepoMenuActions";
import { useRepoAutoRefresh } from "../hooks/useRepoAutoRefresh";
import { DropdownPortal } from "../components/DropdownPortal";
import { BranchSelector } from "../components/BranchSelector";
import { ConfirmDialog, PromptDialog } from "../components/PromptDialog";
import { AnimatedTabPanels } from "../components/AnimatedTabPanels";
import { StashedChangesView } from "../components/StashedChangesView";
import { ToolbarSyncBar } from "../components/ToolbarSyncBar";
import { BranchPickerDialog } from "../components/BranchPickerDialog";
import { PullRequestSidebar } from "../components/PullRequestSidebar";
import { PullRequestDetailView } from "../components/PullRequestDetailView";
import { usePullRequests } from "../hooks/usePullRequests";
import { RepositorySettingsDialog } from "../components/RepositorySettingsDialog";
import { CommandPalette } from "../components/CommandPalette";
import { TagsDialog } from "../components/TagsDialog";
import { CreateRepositoryDialog } from "../components/CreateRepositoryDialog";
import { CoAuthorFields } from "../components/CoAuthorFields";
import { useBranchPicker } from "@/lib/use-branch-picker";
import { buildCommitMessage, type CoAuthor } from "@/lib/build-commit-message";
import { confirmApp, messageApp } from "@/lib/app-dialog";
import { parseGitHubRemote } from "@/lib/github-url";
import { getBranchSyncState } from "@/lib/branch-sync";
import { useRouter } from "next/navigation";
import { Archive, ChevronRight } from "lucide-react";

function statusDotClass(status: string): string {
  if (status === "added" || status === "untracked") return "gh-status-dot--added";
  if (status === "deleted") return "gh-status-dot--deleted";
  return "gh-status-dot--modified";
}

/** Brief minimum so the fetching layer crossfade is perceptible (network may be faster). */
const MIN_FETCH_FEEDBACK_MS = 480;

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export default function RepoPage() {
  const git = useGit();
  const { settings } = useSettings();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"changes" | "history" | "pulls">("changes");
  const [branchCompareLabel, setBranchCompareLabel] = useState<string | null>(null);
  const [forcePushOpen, setForcePushOpen] = useState(false);
  const [repoSettingsOpen, setRepoSettingsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [gpgSignEnabled, setGpgSignEnabled] = useState(false);
  const [signingKey, setSigningKey] = useState<string | null>(null);
  const {
    branchPickerOpen,
    branchPickerOptions,
    requestBranch,
    closeBranchPicker,
    selectBranch,
  } = useBranchPicker();
  const [changesMode, setChangesMode] = useState<"working" | "stashed">("working");
  const [stashCount, setStashCount] = useState(0);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedHistoryFilePath, setSelectedHistoryFilePath] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState("");

  const [toolbarMenu, setToolbarMenu] = useState<"repo" | "branch" | null>(null);
  const closeToolbarMenu = () => setToolbarMenu(null);
  const toggleToolbarMenu = (menu: "repo" | "branch") =>
    setToolbarMenu((current) => (current === menu ? null : menu));
  const openToolbarMenu = (menu: "repo" | "branch") => setToolbarMenu(menu);
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const [branchCreateSignal, setBranchCreateSignal] = useState(0);
  const [renameBranchOpen, setRenameBranchOpen] = useState(false);
  const [deleteBranchOpen, setDeleteBranchOpen] = useState(false);
  const [discardAllOpen, setDiscardAllOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardFilePath, setDiscardFilePath] = useState<string | null>(null);
  const [unstageFilePath, setUnstageFilePath] = useState<string | null>(null);
  const [unstageAllOpen, setUnstageAllOpen] = useState(false);
  const [recentRepos, setRecentRepos] = useState<{ path: string; name: string }[]>([]);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [lastFetchLabel, setLastFetchLabel] = useState("Never fetched");
  const [fetching, setFetching] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    kind: "success";
    text: string;
  } | null>(null);

  const setSyncSuccess = (text: string) => {
    setSyncFeedback({ kind: "success", text });
    window.setTimeout(() => setSyncFeedback(null), 4500);
  };
  const clearSyncFeedback = () => setSyncFeedback(null);

  const notifySyncError = async (text: string, title = "Sync failed") => {
    clearSyncFeedback();
    await messageApp(text, { title, kind: "error" });
  };
  const [diffScrollTarget, setDiffScrollTarget] = useState<DiffScrollTarget | null>(null);
  const [secretsDialogOpen, setSecretsDialogOpen] = useState(false);
  const [commitSafetyOverride, setCommitSafetyOverride] = useState(false);
  const [hasStash, setHasStash] = useState(false);
  const repoPillRef = useRef<HTMLButtonElement>(null);
  const currentBranch = git.repoInfo?.current_branch ?? "main";

  useEffect(() => {
    try {
      const stored = localStorage.getItem("smoke_recent_repos");
      if (stored) setRecentRepos(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, [git.repoPath]);

  useEffect(() => {
    clearSyncFeedback();
  }, [git.repoPath]);

  useEffect(() => {
    if (!git.repoPath) return;
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const remotes = await invoke<{ name: string; url: string }[]>("get_remotes", {
          repoPath: git.repoPath,
        });
        setRemoteUrl(remotes?.[0]?.url ?? null);
      } catch {
        setRemoteUrl(null);
      }
    })();
  }, [git.repoPath]);

  useEffect(() => {
    if (!git.repoPath) {
      setGpgSignEnabled(false);
      setSigningKey(null);
      return;
    }
    void (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const [gpgsign, key] = await Promise.all([
          invoke<string | null>("get_git_config", { repoPath: git.repoPath, key: "commit.gpgsign" }),
          invoke<string | null>("get_git_config", { repoPath: git.repoPath, key: "user.signingkey" }),
        ]);
        const enabled =
          gpgsign === "true" || gpgsign === "1" || gpgsign === "yes" || gpgsign === "on";
        setGpgSignEnabled(enabled);
        setSigningKey(key);
      } catch {
        setGpgSignEnabled(false);
        setSigningKey(null);
      }
    })();
  }, [git.repoPath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!git.repoPath) {
      setHasStash(false);
      return;
    }
    void git
      .stashList()
      .then((list) => {
        setHasStash(list.length > 0);
        setStashCount(list.length);
        if (list.length === 0) setChangesMode("working");
      })
      .catch(() => {
        setHasStash(false);
        setStashCount(0);
      });
  }, [git.repoPath, git.status, git.stashList]);

  useEffect(() => {
    if (activeTab === "history" && git.commits.length > 0 && !git.selectedCommit) {
      void git.selectCommit(git.commits[0]);
    }
  }, [activeTab, git.commits, git.selectedCommit, git.selectCommit]);

  const allChangedFiles = useMemo(() => {
    if (!git.status) return [];
    return [
      ...git.status.staged.map((f) => ({ ...f, section: "staged" as const })),
      ...git.status.unstaged.map((f) => ({ ...f, section: "unstaged" as const })),
      ...git.status.untracked.map((f) => ({ ...f, section: "untracked" as const })),
      ...git.status.conflicts.map((f) => ({ ...f, section: "conflicts" as const })),
    ];
  }, [git.status]);

  useEffect(() => {
    if (allChangedFiles.length > 0) {
      if (!allChangedFiles.some((f) => f.path === selectedFilePath)) {
        setSelectedFilePath(allChangedFiles[0].path);
      }
    } else {
      setSelectedFilePath(null);
    }
  }, [allChangedFiles, selectedFilePath]);

  const commitFiles = git.commitDiff?.files ?? [];

  useEffect(() => {
    if (commitFiles.length > 0) {
      if (!commitFiles.some((f) => f.path === selectedHistoryFilePath)) {
        setSelectedHistoryFilePath(commitFiles[0].path);
      }
    } else {
      setSelectedHistoryFilePath(null);
    }
  }, [commitFiles, selectedHistoryFilePath]);

  const filteredWorkingDiff = useMemo(() => {
    if (!git.workingDiff || !selectedFilePath) return null;
    return {
      ...git.workingDiff,
      files: git.workingDiff.files.filter((f) => f.path === selectedFilePath),
    };
  }, [git.workingDiff, selectedFilePath]);

  const filteredStagedDiff = useMemo(() => {
    if (!git.stagedDiff || !selectedFilePath) return null;
    return {
      ...git.stagedDiff,
      files: git.stagedDiff.files.filter((f) => f.path === selectedFilePath),
    };
  }, [git.stagedDiff, selectedFilePath]);

  const filteredCommitDiff = useMemo(() => {
    if (!git.commitDiff || !selectedHistoryFilePath) return null;
    return {
      ...git.commitDiff,
      files: git.commitDiff.files.filter((f) => f.path === selectedHistoryFilePath),
    };
  }, [git.commitDiff, selectedHistoryFilePath]);

  const syncBusy = pulling || pushing || fetching;

  useRepoAutoRefresh({
    enabled: !!git.repoPath,
    busy: git.loading || syncBusy,
    onExternalChange: () => {
      setSyncSuccess("Repository updated on disk");
    },
  });
  const conflictCount = git.status?.conflicts.length ?? 0;
  const changeCount =
    (git.status?.staged.length ?? 0) +
    (git.status?.unstaged.length ?? 0) +
    (git.status?.untracked.length ?? 0) +
    conflictCount;

  const isClean = allChangedFiles.length === 0;

  const stagedSecrets = useMemo(
    () => collectSecretsFromDiffs(null, git.stagedDiff, undefined, settings.customSecretPatterns),
    [git.stagedDiff, settings.customSecretPatterns]
  );

  const selectedIsConflict =
    selectedFilePath != null &&
    (git.status?.conflicts.some((f) => f.path === selectedFilePath) ?? false);

  const handleChooseLocalRepo = async () => {
    closeToolbarMenu();
    const { pickAndAddExistingRepository, saveRecentRepository } = await import("@/lib/open-repo");
    const result = await pickAndAddExistingRepository();
    if (!result.ok) {
      if (result.error) alert(result.error);
      return;
    }
    saveRecentRepository(result.path, result.name);
    await git.openRepo(result.path);
  };

  const handleFetch = async () => {
    if (fetching) return;
    if (!remoteUrl) {
      void notifySyncError("No remote configured", "Fetch");
      return;
    }
    setFetching(true);
    clearSyncFeedback();
    const started = Date.now();
    try {
      const result = await git.fetchRemote();
      await git.refreshAll();
      const waitMs = Math.max(0, MIN_FETCH_FEEDBACK_MS - (Date.now() - started));
      if (waitMs > 0) await sleep(waitMs);
      setLastFetchLabel("Last fetched just now");
      if (!result.ok) void notifySyncError(result.message, "Fetch");
    } catch (err: unknown) {
      const waitMs = Math.max(0, MIN_FETCH_FEEDBACK_MS - (Date.now() - started));
      if (waitMs > 0) await sleep(waitMs);
      void notifySyncError(err instanceof Error ? err.message : String(err), "Fetch");
    } finally {
      setFetching(false);
    }
  };

  const handlePull = async () => {
    if (pulling || !remoteUrl) return;
    setPulling(true);
    clearSyncFeedback();
    try {
      const result = await git.pullRemote();
      await git.refreshAll();
      if (result.ok) setSyncSuccess(result.message);
      else void notifySyncError(result.message, "Pull");
      if (result.conflict_paths.length > 0 && result.conflict_paths[0]) {
        setSelectedFilePath(result.conflict_paths[0]);
        setActiveTab("changes");
      }
    } catch (err: unknown) {
      void notifySyncError(err instanceof Error ? err.message : String(err), "Pull");
    } finally {
      setPulling(false);
    }
  };

  const handlePush = async (force = false) => {
    if (pushing || !remoteUrl) return;

    if (!force) {
      const prePushSecrets =
        collectSecretsFromDiffs(
          git.workingDiff,
          git.stagedDiff,
          undefined,
          settings.customSecretPatterns
        ).length;
      if (prePushSecrets > 0 && settings.commitSafety !== "off") {
        const proceed = await confirmApp(
          `${prePushSecrets} potential secret(s) in local changes. Push anyway?`
        );
        if (!proceed) return;
      }
      try {
        try {
          await git.fetchRemote();
          await git.refreshAll();
        } catch {
          /* continue — push may still work */
        }
        const needsForce = await git.checkPushRequiresForce();
        if (needsForce) {
          setForcePushOpen(true);
          return;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg) void notifySyncError(msg, "Push");
      }
    }

    setPushing(true);
    clearSyncFeedback();
    try {
      const result = await git.pushRemote(force);
      await git.refreshAll();
      setLastFetchLabel("Last fetched just now");
      setSyncSuccess(result.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      void notifySyncError(msg, "Push failed");
      if (
        !force &&
        /non-fast-forward|fetch first|\[rejected\]/i.test(msg) &&
        !/protected|gh006|hook declined/i.test(msg)
      ) {
        setForcePushOpen(true);
      }
    } finally {
      setPushing(false);
    }
  };

  const handleSecretNavigate = (finding: SecretFinding) => {
    setActiveTab("changes");
    setSelectedFilePath(finding.file);
    setDiffScrollTarget({
      file: finding.file,
      line: finding.line,
      hunkIndex: finding.hunkIndex,
      lineIndex: finding.lineIndex,
      lineKey: `${finding.file}-${finding.hunkIndex}-${finding.lineIndex}`,
    });
  };

  const openOnGitHub = async () => {
    if (!remoteUrl) return;
    const { open: openUrl } = await import("@tauri-apps/plugin-shell");
    let url = remoteUrl.trim();
    if (url.startsWith("git@github.com:")) {
      url = `https://github.com/${url.slice("git@github.com:".length)}`;
    }
    url = url.replace(/\.git$/, "");
    const branch = git.repoInfo?.current_branch;
    if (branch && url.includes("github.com")) {
      url = `${url}/tree/${encodeURIComponent(branch)}`;
    }
    await openUrl(url);
  };

  const handleStashSave = async () => {
    const msg = window.prompt("Stash message (optional):", "WIP");
    if (msg === null) return;
    try {
      await git.stashSave(msg.trim() || undefined);
      const list = await git.stashList();
      setHasStash(list.length > 0);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStashPop = async () => {
    if (!hasStash) return;
    if (
      !(await confirmApp(
        "Pop the latest stash? Staged changes will be restored and the stash removed."
      ))
    ) {
      return;
    }
    try {
      await git.stashPop();
      const list = await git.stashList();
      setHasStash(list.length > 0);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStashApply = async () => {
    if (!hasStash) return;
    try {
      await git.stashApply();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSignOut = async () => {
    await clearAuth();
    window.location.href = "/";
  };

  const handleCommitSubmit = async () => {
    if (!commitMsg.trim()) return;
    const safety = settings.commitSafety;
    if (safety !== "off" && stagedSecrets.length > 0 && !commitSafetyOverride) {
      if (safety === "block") {
        setSecretsDialogOpen(true);
        return;
      }
      const proceed = await confirmApp(
        `${stagedSecrets.length} potential secret${stagedSecrets.length === 1 ? "" : "s"} in staged changes.\n\nCommit anyway?`
      );
      if (!proceed) {
        setSecretsDialogOpen(true);
        return;
      }
    }
    const fullMessage = buildCommitMessage(commitMsg, coAuthors);
    await git.createCommit(fullMessage, gpgSignEnabled);
    setCommitMsg("");
    setCoAuthors([]);
    setCommitSafetyOverride(false);
  };

  const handleOpenInTerminal = async () => {
    if (!git.repoPath) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_repo_in_terminal", { repoPath: git.repoPath });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenInEditor = async () => {
    if (!git.repoPath) return;
    const editor = settings.externalEditor.trim();
    if (!editor) {
      alert("Set an external editor in App settings (e.g. code or codium).");
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_in_external_editor", { repoPath: git.repoPath, editorCommand: editor });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const refreshRemoteUrl = async () => {
    if (!git.repoPath) return;
    const { invoke } = await import("@tauri-apps/api/core");
    const remotes = await invoke<{ name: string; url: string }[]>("get_remotes", {
      repoPath: git.repoPath,
    });
    const origin = remotes.find((r) => r.name === "origin") ?? remotes[0];
    setRemoteUrl(origin?.url ?? null);
  };

  const cleanStateProps = {
    remoteUrl,
    lastFetchLabel,
    fetching,
    pulling,
    pushing,
    onOpenHistory: () => {
      setActiveTab("history");
      if (git.commits[0]) void git.selectCommit(git.commits[0]);
    },
    onFetch: () => void handleFetch(),
    onPull: () => void handlePull(),
    onPush: () => void handlePush(),
    onOpenFolder: () => void git.openRepoFolder(),
    onViewOnGitHub: () => void openOnGitHub(),
    onPublish: !remoteUrl ? () => setPublishOpen(true) : undefined,
  };

  const filteredRecentRepos = recentRepos.filter((r) =>
    r.name.toLowerCase().includes(repoSearchQuery.toLowerCase())
  );
  const hasGitHubRemote = !!parseGitHubRemote(remoteUrl);
  const branchSync = getBranchSyncState(remoteUrl, git.repoInfo);
  const { branchUnpublished, canPush: canPushBranch } = branchSync;
  const prInbox = usePullRequests(remoteUrl);

  const menuActions = useRepoMenuActions({
    remoteUrl,
    hasLocalChanges: !isClean,
    hasStash,
    requestBranchPick: requestBranch,
    onNewBranch: () => {
      openToolbarMenu("branch");
      setBranchCreateSignal((n) => n + 1);
    },
    onRenameBranch: () => setRenameBranchOpen(true),
    onDeleteBranch: () => setDeleteBranchOpen(true),
    onShowStashed: () => {
      setActiveTab("changes");
      setChangesMode("stashed");
    },
    onPull: () => void handlePull(),
    onPush: () => void handlePush(),
    onPublishBranch: remoteUrl ? () => void handlePush() : undefined,
    publishBranchDisabled: !canPushBranch,
    branchUnpublished,
    onFetch: () => void handleFetch(),
    onDiscardAll: () => setDiscardAllOpen(true),
    onStashSave: () => void handleStashSave(),
    onStashPop: () => void handleStashPop(),
    onStashApply: () => void handleStashApply(),
    onPreviewPullRequest: () => setActiveTab("pulls"),
    onCompareBranchInApp: (base, compare) => {
      setBranchCompareLabel(`${base}…${compare}`);
      setActiveTab("changes");
      setSelectedFilePath(null);
    },
    onSyncMessage: (msg) => {
      if (/conflict|failed|error/i.test(msg)) void notifySyncError(msg);
      else setSyncSuccess(msg);
    },
    onMergeConflicts: (paths) => {
      if (paths[0]) {
        setSelectedFilePath(paths[0]);
        setActiveTab("changes");
      }
    },
  });

  if (!git.repoHydrated || (git.loading && !git.repoPath)) {
    return (
      <div className="gh-empty-state" style={{ height: "100vh" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)", marginBottom: 12 }} />
        <span>Opening repository…</span>
      </div>
    );
  }

  if (!git.repoPath) {
    return (
      <div className="gh-home">
        <AppMenubar
          variant="home"
          actions={{
            onAddLocalRepo: () => void handleChooseLocalRepo(),
            onChooseRepository: () => router.push("/dashboard"),
            onSignOut: () => void handleSignOut(),
          }}
        />
        <div className="gh-empty-state gh-empty-state--pane">
          <FolderOpen size={32} style={{ color: "var(--aero-sky)", opacity: 0.7, marginBottom: 12 }} />
          <span>No repository open</span>
          {git.error && (
            <p style={{ marginTop: 8, color: "var(--danger)", maxWidth: 420, textAlign: "center" }}>
              {git.error}
            </p>
          )}
          <button
            type="button"
            className="gh-btn gh-btn--primary"
            style={{ marginTop: 16 }}
            onClick={() => router.push("/dashboard")}
          >
            Back to repository list
          </button>
          <button
            type="button"
            className="gh-btn"
            style={{ marginTop: 8 }}
            onClick={() => void handleChooseLocalRepo()}
          >
            Add local repository…
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gh-app">
      <AppMenubar
        variant="repo"
        actions={{
          ...menuActions,
          onGoHome: () => {
            import("@/lib/active-repo").then(({ clearActiveRepository }) => {
              clearActiveRepository();
            });
            router.push("/dashboard");
          },
          onAddLocalRepo: () => void handleChooseLocalRepo(),
          onChooseRepository: () => router.push("/dashboard"),
          onSignOut: () => void handleSignOut(),
          onRepositorySettings: () => setRepoSettingsOpen(true),
          onOpenInTerminal: () => void handleOpenInTerminal(),
          onOpenInEditor: () => void handleOpenInEditor(),
          onManageTags: () => setTagsDialogOpen(true),
          onPublishRepository: !remoteUrl ? () => setPublishOpen(true) : undefined,
          onPublishBranch: remoteUrl ? () => void handlePush() : undefined,
          publishBranchDisabled: !canPushBranch,
          branchUnpublished,
        }}
      />
      <div className="gh-toolbar">
        <button
          ref={repoPillRef}
          type="button"
          className={`gh-toolbar-section${toolbarMenu === "repo" ? " gh-toolbar-section--open" : ""}`}
          onClick={() => toggleToolbarMenu("repo")}
        >
          <FolderOpen size={16} className="gh-toolbar-section-icon" />
          <div className="gh-toolbar-section-body">
            <span className="gh-toolbar-label">Current repository</span>
            <span className="gh-toolbar-value">{git.repoInfo?.name ?? "…"}</span>
          </div>
          <ChevronDown size={14} className="gh-toolbar-chevron" />
        </button>

        <DropdownPortal
          open={toolbarMenu === "repo"}
          onClose={closeToolbarMenu}
          anchorRef={repoPillRef}
        >
          <div className="gh-dropdown-header">Recent repositories</div>
          <div style={{ padding: 8 }}>
            <input
              className="login-pat-input"
              style={{ width: "100%" }}
              placeholder="Filter…"
              value={repoSearchQuery}
              onChange={(e) => setRepoSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: 200, overflow: "auto" }}>
            {filteredRecentRepos.map((r) => (
              <button
                key={r.path}
                type="button"
                className="gh-dropdown-item"
                onClick={() => {
                  void git.openRepo(r.path);
                  closeToolbarMenu();
                }}
              >
                <Folder size={12} style={{ display: "inline", marginRight: 8 }} />
                {r.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="gh-dropdown-item"
            onClick={() => {
              closeToolbarMenu();
              void handleChooseLocalRepo();
            }}
          >
            Add local repository…
          </button>
          <a
            href="/dashboard"
            className="gh-dropdown-item"
            onClick={() => closeToolbarMenu()}
          >
            Choose a different repository…
          </a>
          <button
            type="button"
            className="gh-dropdown-item"
            onClick={() => {
              closeToolbarMenu();
              void openOnGitHub();
            }}
            disabled={!remoteUrl}
          >
            View on GitHub
          </button>
          <button
            type="button"
            className="gh-dropdown-item"
            onClick={() => {
              closeToolbarMenu();
              void handleSignOut();
            }}
          >
            Sign out
          </button>
        </DropdownPortal>

        <BranchSelector
          variant="toolbar"
          openCreateSignal={branchCreateSignal}
          menuOpen={toolbarMenu === "branch"}
          onMenuOpenChange={(open) => setToolbarMenu(open ? "branch" : null)}
        />

        <div
          className={`gh-toolbar-section gh-toolbar-section--sync${syncBusy ? " gh-toolbar-section--sync--busy" : ""}`}
        >
          <ToolbarSyncBar
            remoteUrl={remoteUrl}
            repoInfo={git.repoInfo}
            feedbackText={syncFeedback?.text ?? null}
            feedbackKind={syncFeedback?.kind ?? null}
            fetching={fetching}
            pulling={pulling}
            pushing={pushing}
            onFetch={() => void handleFetch()}
            onPull={() => void handlePull()}
            onPush={() => void handlePush()}
          />
        </div>
      </div>

      {activeTab === "changes" && changesMode === "stashed" ? (
        <StashedChangesView
          onBack={() => setChangesMode("working")}
          onRestored={() => {
            setChangesMode("working");
            setActiveTab("changes");
          }}
        />
      ) : (
      <div className="gh-workspace">
        <aside className="gh-sidebar">
          <div className="gh-sidebar-tabs">
            <button
              type="button"
              className={`gh-sidebar-tab${activeTab === "changes" ? " gh-sidebar-tab--active" : ""}`}
              onClick={() => setActiveTab("changes")}
            >
              Changes
              {changeCount > 0 && (
                <span className={`gh-tab-count${conflictCount > 0 ? " gh-tab-count--danger" : ""}`}>
                  {changeCount}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`gh-sidebar-tab${activeTab === "history" ? " gh-sidebar-tab--active" : ""}`}
              onClick={() => {
                setActiveTab("history");
                git.clearBranchCompareDiff();
                setBranchCompareLabel(null);
              }}
            >
              History
            </button>
            {hasGitHubRemote && (
              <button
                type="button"
                className={`gh-sidebar-tab${activeTab === "pulls" ? " gh-sidebar-tab--active" : ""}`}
                onClick={() => setActiveTab("pulls")}
              >
                Pull requests
                {!prInbox.listLoading && prInbox.prs.length > 0 && (
                  <span className="gh-tab-count">{prInbox.prs.length}</span>
                )}
              </button>
            )}
          </div>

          <AnimatedTabPanels
            active={
              activeTab === "pulls"
                ? "pulls"
                : activeTab === "history"
                  ? "history"
                  : "changes"
            }
            className="gh-sidebar-body"
            panels={[
              {
                id: "changes",
                content: (
              <div className="gh-changes-panel">
                <div className="gh-changes-panel__scroll">
                  {isClean ? (
                    <ChangesSidebarEmpty remoteUrl={remoteUrl} />
                  ) : (
                    <>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 12px",
                          borderBottom: "1px solid var(--gh-border)",
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={git.status?.staged.length === allChangedFiles.length}
                          onChange={() => {
                            if (git.status?.staged.length === allChangedFiles.length) {
                              if ((git.status?.staged.length ?? 0) > 0) setUnstageAllOpen(true);
                            } else {
                              void git.stageAll();
                            }
                          }}
                        />
                        {allChangedFiles.length} changed file{allChangedFiles.length !== 1 ? "s" : ""}
                      </label>
                      {allChangedFiles.map((f) => {
                        const isStaged = f.section === "staged";
                        const isConflict = f.section === "conflicts";
                        const selected = selectedFilePath === f.path;
                        return (
                          <div
                            key={f.path}
                            className={`gh-file-row${selected ? " gh-file-row--selected" : ""}${isConflict ? " gh-file-row--conflict" : ""}`}
                            onClick={() => setSelectedFilePath(f.path)}
                          >
                            {!isConflict && (
                              <button
                                type="button"
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isStaged) setUnstageFilePath(f.path);
                                  else void git.stageFile(f.path);
                                }}
                              >
                                {isStaged ? (
                                  <CheckSquare size={14} style={{ color: "var(--accent)" }} />
                                ) : (
                                  <Square size={14} style={{ color: "var(--text-tertiary)" }} />
                                )}
                              </button>
                            )}
                            <span className={`gh-status-dot ${isConflict ? "gh-status-dot--deleted" : statusDotClass(f.status)}`} />
                            <span className="gh-file-path">{f.path}</span>
                            {!isConflict && f.section !== "staged" && (
                              <button
                                type="button"
                                className="gh-file-discard"
                                title="Discard changes"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDiscardFilePath(f.path);
                                }}
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
                {hasStash && changesMode === "working" && (
                  <button
                    type="button"
                    className="gh-stash-footer"
                    onClick={() => setChangesMode("stashed")}
                  >
                    <Archive size={14} aria-hidden />
                    <span className="gh-stash-footer__label">
                      Stashed changes
                      {stashCount > 1 ? ` (${stashCount})` : ""}
                    </span>
                    <ChevronRight size={14} className="gh-stash-footer__chevron" aria-hidden />
                  </button>
                )}
                {!isClean && (
                <div className="gh-commit-box">
                  {settings.commitSafety !== "off" && stagedSecrets.length > 0 && (
                    <div
                      className={`gh-commit-safety-banner${settings.commitSafety === "warn" ? " gh-commit-safety-banner--warn" : ""}`}
                      role="alert"
                    >
                      <div className="gh-commit-safety-banner__row">
                        <AlertTriangle size={14} style={{ flexShrink: 0, color: "var(--danger)" }} />
                        <span>
                          {stagedSecrets.length} potential secret{stagedSecrets.length === 1 ? "" : "s"} in staged
                          changes
                          {settings.commitSafety === "block" ? " — commit blocked" : ""}
                        </span>
                      </div>
                      <div className="gh-commit-safety-banner__actions">
                        <button
                          type="button"
                          className="gh-commit-safety-banner__link"
                          onClick={() => setSecretsDialogOpen(true)}
                        >
                          Review secrets
                        </button>
                        {settings.commitSafety === "warn" && (
                          <button
                            type="button"
                            className="gh-commit-safety-banner__link"
                            onClick={() => setCommitSafetyOverride(true)}
                          >
                            Commit anyway
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {gpgSignEnabled && (
                    <div className="gh-commit-gpg-hint" title={signingKey ?? undefined}>
                      Commits will be GPG-signed
                      {signingKey ? ` (${signingKey})` : ""}
                    </div>
                  )}
                  <textarea
                    className="gh-commit-input"
                    value={commitMsg}
                    onChange={(e) => {
                      setCommitMsg(e.target.value);
                      setCommitSafetyOverride(false);
                    }}
                    placeholder={`Summary (required)\n\nDescription`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleCommitSubmit();
                    }}
                  />
                  <CoAuthorFields authors={coAuthors} onChange={setCoAuthors} />
                  <button
                    type="button"
                    className="ghd-add-trigger ghd-add-trigger--commit"
                    disabled={
                      !commitMsg.trim() ||
                      (git.status?.staged.length ?? 0) === 0 ||
                      conflictCount > 0 ||
                      (settings.commitSafety === "block" &&
                        stagedSecrets.length > 0 &&
                        !commitSafetyOverride)
                    }
                    onClick={() => void handleCommitSubmit()}
                  >
                    <span className="ghd-add-trigger__label">
                      {gpgSignEnabled ? "Sign & commit" : "Commit"} to{" "}
                      {git.repoInfo?.current_branch ?? "main"}
                    </span>
                  </button>
                </div>
                )}
              </div>
                ),
              },
              {
                id: "history",
                content: (
              <>
                <div className="gh-history-filter">
                  <input
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                    placeholder="Filter history"
                  />
                </div>
                <CommitHistoryList
                  filter={historyFilter}
                  remoteUrl={remoteUrl}
                  onRevertConflicts={(paths) => {
                    if (paths[0]) {
                      setSelectedFilePath(paths[0]);
                      setActiveTab("changes");
                      setChangesMode("working");
                    }
                  }}
                />
              </>
                ),
              },
              ...(hasGitHubRemote
                ? [
                    {
                      id: "pulls" as const,
                      content: <PullRequestSidebar inbox={prInbox} />,
                    },
                  ]
                : []),
            ]}
          />
        </aside>

        <AnimatedTabPanels
          active={activeTab}
          className="gh-workspace-panels"
          panels={[
            {
              id: "changes",
              content: (
          <main className="gh-diff-pane">
            {branchCompareLabel && git.branchCompareDiff ? (
              <>
                <div className="diff-branch-compare-bar">
                  <span>Comparing {branchCompareLabel}</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      git.clearBranchCompareDiff();
                      setBranchCompareLabel(null);
                    }}
                  >
                    Close
                  </button>
                </div>
                <DiffViewer diff={git.branchCompareDiff} remoteUrl={remoteUrl} />
              </>
            ) : selectedFilePath && selectedIsConflict ? (
              <ConflictResolver filePath={selectedFilePath} />
            ) : selectedFilePath ? (
              <DiffViewer
                diff={filteredWorkingDiff}
                stagedDiff={filteredStagedDiff}
                remoteUrl={remoteUrl}
                secretScope={{ working: git.workingDiff, staged: git.stagedDiff }}
                scrollTarget={diffScrollTarget}
                onScrollTargetDone={() => setDiffScrollTarget(null)}
                onSecretNavigate={handleSecretNavigate}
                enableHunkStaging
              />
            ) : isClean ? (
              <ChangesCleanState variant="expanded" {...cleanStateProps} />
            ) : (
              <div className="gh-empty-state">
                Select a changed file to view its diff
              </div>
            )}
          </main>
              ),
            },
            {
              id: "history",
              content: (
          <>
            <div className="gh-file-pane">
              <div className="gh-file-pane-header">
                {commitFiles.length > 0
                  ? `${commitFiles.length} changed file${commitFiles.length !== 1 ? "s" : ""}`
                  : "Changed files"}
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                {!git.selectedCommit ? (
                  <div className="gh-empty-state">Select a commit</div>
                ) : commitFiles.length === 0 ? (
                  <div className="gh-empty-state">No file changes</div>
                ) : (
                  commitFiles.map((f) => {
                    const selected = selectedHistoryFilePath === f.path;
                    return (
                      <button
                        key={f.path}
                        type="button"
                        className={`gh-file-row${selected ? " gh-file-row--selected" : ""}`}
                        style={{ width: "100%", border: "none", fontFamily: "inherit" }}
                        onClick={() => setSelectedHistoryFilePath(f.path)}
                      >
                        <span className={`gh-status-dot ${statusDotClass(f.status)}`} />
                        <span className="gh-file-path">{f.path}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <main className="gh-diff-pane">
              {git.selectedCommit && selectedHistoryFilePath ? (
                <DiffViewer
                  diff={filteredCommitDiff}
                  remoteUrl={remoteUrl}
                  secretScope={{ commit: git.commitDiff }}
                />
              ) : (
                <div className="gh-empty-state">
                  {git.selectedCommit ? "Select a file to view diff" : "Select a commit from history"}
                </div>
              )}
            </main>
          </>
              ),
            },
            ...(hasGitHubRemote
              ? [
                  {
                    id: "pulls" as const,
                    content: <PullRequestDetailView inbox={prInbox} />,
                  },
                ]
              : []),
          ]}
        />
      </div>
      )}

      <SecretsDialog
        open={secretsDialogOpen}
        findings={stagedSecrets}
        onClose={() => setSecretsDialogOpen(false)}
        onNavigate={handleSecretNavigate}
      />

      <PromptDialog
        open={renameBranchOpen}
        title="Rename branch"
        label="New branch name"
        defaultValue={currentBranch}
        confirmLabel="Rename"
        onClose={() => setRenameBranchOpen(false)}
        onConfirm={async (name) => {
          setRenameBranchOpen(false);
          if (!name || name === currentBranch) return;
          try {
            await git.renameBranch(currentBranch, name);
          } catch (err: unknown) {
            alert(err instanceof Error ? err.message : String(err));
          }
        }}
      />

      <ConfirmDialog
        open={deleteBranchOpen}
        title="Delete branch"
        message={`Delete branch "${currentBranch}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteBranchOpen(false)}
        onConfirm={async () => {
          setDeleteBranchOpen(false);
          try {
            await git.deleteBranch(currentBranch);
          } catch (err: unknown) {
            alert(err instanceof Error ? err.message : String(err));
          }
        }}
      />

      <ConfirmDialog
        open={discardFilePath !== null}
        title="Discard changes"
        message={
          discardFilePath
            ? `Discard all changes to ${discardFilePath}? This cannot be undone.`
            : ""
        }
        confirmLabel="Discard"
        danger
        onClose={() => setDiscardFilePath(null)}
        onConfirm={() => {
          const path = discardFilePath;
          setDiscardFilePath(null);
          if (path) void git.discardFile(path);
        }}
      />

      <ConfirmDialog
        open={unstageFilePath !== null}
        title="Unstage file"
        message={
          unstageFilePath
            ? `Remove ${unstageFilePath} from this commit? The file will stay modified in your working tree.`
            : ""
        }
        confirmLabel="Unstage"
        onClose={() => setUnstageFilePath(null)}
        onConfirm={() => {
          const path = unstageFilePath;
          setUnstageFilePath(null);
          if (path) void git.unstageFile(path);
        }}
      />

      <ConfirmDialog
        open={unstageAllOpen}
        title="Unstage all files"
        message="Remove all staged files from this commit? Your changes will remain in the working tree."
        confirmLabel="Unstage all"
        onClose={() => setUnstageAllOpen(false)}
        onConfirm={() => {
          setUnstageAllOpen(false);
          void git.unstageAll();
        }}
      />

      <ConfirmDialog
        open={discardAllOpen}
        title="Discard all changes"
        message="Discard all local changes? This cannot be undone."
        confirmLabel="Discard"
        danger
        onClose={() => setDiscardAllOpen(false)}
        onConfirm={() => {
          setDiscardAllOpen(false);
          void git.discardAllChanges();
        }}
      />

      <ConfirmDialog
        open={forcePushOpen}
        title="Push rejected"
        message="Origin has commits you don't have locally (non-fast-forward). Pull first to merge them, or force push with lease to overwrite the remote branch — only if you're sure."
        confirmLabel="Force push"
        danger
        onClose={() => setForcePushOpen(false)}
        onConfirm={() => {
          setForcePushOpen(false);
          void handlePush(true);
        }}
      />

      <BranchPickerDialog
        open={branchPickerOpen}
        options={branchPickerOptions}
        branches={git.branches}
        currentBranch={currentBranch}
        onSelect={selectBranch}
        onClose={closeBranchPicker}
      />

      <RepositorySettingsDialog
        open={repoSettingsOpen}
        repoPath={git.repoPath}
        onClose={() => setRepoSettingsOpen(false)}
        onRemotesChanged={() => {
          void refreshRemoteUrl();
        }}
      />

      <TagsDialog
        open={tagsDialogOpen}
        repoPath={git.repoPath}
        remoteUrl={remoteUrl}
        onClose={() => setTagsDialogOpen(false)}
        onMessage={(msg) => void notifySyncError(msg, "Tags")}
      />

      <CreateRepositoryDialog
        open={publishOpen}
        mode="publish"
        repoPath={git.repoPath}
        defaultName={git.repoInfo?.name ?? ""}
        onClose={() => setPublishOpen(false)}
        onSuccess={() => {
          void refreshRemoteUrl();
          void git.refreshAll();
          setSyncSuccess("Repository published to GitHub.");
        }}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        remoteUrl={remoteUrl}
        currentBranch={currentBranch}
        branches={git.branches}
        onSelectTab={setActiveTab}
        onFetch={() => void handleFetch()}
        onPull={() => void handlePull()}
        onPush={() => void handlePush()}
        onNewBranch={() => {
          openToolbarMenu("branch");
          setBranchCreateSignal((n) => n + 1);
        }}
        onOpenRepoSettings={() => setRepoSettingsOpen(true)}
      />
    </div>
  );
}
