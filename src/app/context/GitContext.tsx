"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { headCommitHash, workingTreeFingerprint } from "@/lib/repo-fingerprint";

export interface CommitInfo {
  hash: string;
  short_hash: string;
  parents: string[];
  author_name: string;
  author_email: string;
  message: string;
  summary: string;
  timestamp: number;
  refs: string[];
  is_head: boolean;
  author_avatar: string;
}

export interface RepoInfo {
  path: string;
  name: string;
  current_branch: string;
  is_dirty: boolean;
  ahead: number;
  behind: number;
  upstream_set: boolean;
  total_commits: number;
  branches: string[];
}

export interface FileStatus {
  path: string;
  status: string;
  is_staged: boolean;
  is_conflict: boolean;
}

export interface WorkingTreeStatus {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];
  conflicts: FileStatus[];
  is_clean: boolean;
}

export interface DiffLine {
  origin: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
  is_secret: boolean;
  secret_type: string | null;
}

export interface DiffHunk {
  header: string;
  old_start: number;
  new_start: number;
  old_lines: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  status: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  has_secrets: boolean;
  binary: boolean;
}

export interface DiffResult {
  files: DiffFile[];
  total_additions: number;
  total_deletions: number;
  total_files: number;
  total_secrets: number;
}

export interface BranchInfo {
  name: string;
  is_head: boolean;
  is_remote: boolean;
  upstream: string | null;
  last_commit_hash: string;
  last_commit_summary: string;
}

export interface SyncResult {
  ok: boolean;
  message: string;
  conflict_paths: string[];
}

export interface ConflictDetail {
  path: string;
  base: string | null;
  ours: string;
  theirs: string;
  working: string;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) {
    throw new Error("Tauri is not running");
  }
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return await tauriInvoke<T>(cmd, args);
}

interface GitContextType {
  // Repo state
  repoPath: string | null;
  repoHydrated: boolean;
  repoInfo: RepoInfo | null;
  commits: CommitInfo[];
  status: WorkingTreeStatus | null;
  branches: BranchInfo[];
  selectedCommit: CommitInfo | null;
  commitDiff: DiffResult | null;
  workingDiff: DiffResult | null;
  stagedDiff: DiffResult | null;
  branchCompareDiff: DiffResult | null;
  loading: boolean;
  error: string | null;

  // Actions
  openRepo: (path: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshBackground: () => Promise<boolean>;
  pauseBackgroundRefresh: () => void;
  resumeBackgroundRefresh: () => void;
  selectCommit: (commit: CommitInfo | null) => void;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  createCommit: (message: string, sign?: boolean) => Promise<void>;
  checkoutBranch: (name: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  deleteBranch: (name: string) => Promise<void>;
  renameBranch: (oldName: string, newName: string) => Promise<void>;
  mergeBranch: (branchName: string) => Promise<SyncResult>;
  rebaseOnto: (upstreamBranch: string) => Promise<SyncResult>;
  rebaseAbort: () => Promise<void>;
  rebaseContinue: () => Promise<SyncResult>;
  squashMergeBranch: (branchName: string) => Promise<SyncResult>;
  getBranchDiff: (baseBranch: string, compareBranch: string) => Promise<DiffResult>;
  clearBranchCompareDiff: () => void;
  stageHunk: (patch: string) => Promise<void>;
  unstageHunk: (patch: string) => Promise<void>;
  fetchRemote: () => Promise<SyncResult>;
  pullRemote: () => Promise<SyncResult>;
  pushRemote: (force?: boolean) => Promise<SyncResult>;
  checkPushRequiresForce: () => Promise<boolean>;
  discardFile: (path: string) => Promise<void>;
  discardAllChanges: () => Promise<void>;
  getConflictDetail: (path: string) => Promise<ConflictDetail>;
  resolveConflict: (
    path: string,
    resolution: "ours" | "theirs" | "manual",
    content?: string
  ) => Promise<void>;
  abortMerge: () => Promise<void>;
  stashSave: (message?: string) => Promise<void>;
  stashPop: (stashIndex?: number) => Promise<void>;
  stashApply: (stashIndex?: number) => Promise<void>;
  stashDrop: (stashIndex?: number) => Promise<void>;
  stashList: () => Promise<StashEntry[]>;
  getStashDiff: (stashIndex: number) => Promise<DiffResult>;
  amendCommit: (message?: string) => Promise<void>;
  revertCommit: (commitHash: string) => Promise<RevertResult>;
  cherryPickCommit: (commitHash: string) => Promise<RevertResult>;
  openRepoFolder: () => Promise<void>;
}

export interface RevertResult {
  ok: boolean;
  message: string;
  conflict_paths: string[];
}

export interface StashEntry {
  index: number;
  message: string;
  oid: string;
}

const GitContext = createContext<GitContextType | null>(null);

export function useGit() {
  const ctx = useContext(GitContext);
  if (!ctx) throw new Error("useGit must be inside GitProvider");
  return ctx;
}

export function GitProvider({ children }: { children: React.ReactNode }) {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [repoHydrated, setRepoHydrated] = useState(false);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [status, setStatus] = useState<WorkingTreeStatus | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitDiff, setCommitDiff] = useState<DiffResult | null>(null);
  const [workingDiff, setWorkingDiff] = useState<DiffResult | null>(null);
  const [stagedDiff, setStagedDiff] = useState<DiffResult | null>(null);
  const [branchCompareDiff, setBranchCompareDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundPauseRef = useRef(0);
  const fingerprintRef = useRef<string>("");
  const headRef = useRef<string | null>(null);

  const pauseBackgroundRefresh = useCallback(() => {
    backgroundPauseRef.current += 1;
  }, []);

  const resumeBackgroundRefresh = useCallback(() => {
    backgroundPauseRef.current = Math.max(0, backgroundPauseRef.current - 1);
  }, []);

  const loadRepo = useCallback(async (path: string) => {
    setRepoPath(path);
    setSelectedCommit(null);
    setCommitDiff(null);
    setLoading(true);
    setError(null);
    try {
      const [info, hist, st, br, wd, sd] = await Promise.all([
        invoke<RepoInfo>("get_repo_info", { repoPath: path }),
        invoke<CommitInfo[]>("get_history", { repoPath: path, maxCount: 300 }),
        invoke<WorkingTreeStatus>("get_status", { repoPath: path }),
        invoke<BranchInfo[]>("get_branches", { repoPath: path }),
        invoke<DiffResult>("get_working_diff", { repoPath: path }),
        invoke<DiffResult>("get_staged_diff", { repoPath: path }),
      ]);
      setRepoInfo(info);
      setCommits(hist);
      setStatus(st);
      setBranches(br);
      setWorkingDiff(wd);
      setStagedDiff(sd);
      fingerprintRef.current = workingTreeFingerprint(st);
      headRef.current = headCommitHash(hist);
      const { setActiveRepository } = await import("@/lib/active-repo");
      setActiveRepository(path);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      try {
        if (window.location.pathname === "/repo") {
          const { getActiveRepository } = await import("@/lib/active-repo");
          const saved = getActiveRepository();
          if (saved) {
            await loadRepo(saved);
          }
        }
      } catch {
        /* error already set on context */
      } finally {
        if (!cancelled) setRepoHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadRepo]);

  const refreshAll = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const [info, hist, st, br, wd, sd] = await Promise.all([
        invoke<RepoInfo>("get_repo_info", { repoPath }),
        invoke<CommitInfo[]>("get_history", { repoPath, maxCount: 300 }),
        invoke<WorkingTreeStatus>("get_status", { repoPath }),
        invoke<BranchInfo[]>("get_branches", { repoPath }),
        invoke<DiffResult>("get_working_diff", { repoPath }),
        invoke<DiffResult>("get_staged_diff", { repoPath }),
      ]);
      setRepoInfo(info);
      setCommits(hist);
      setStatus(st);
      setBranches(br);
      setWorkingDiff(wd);
      setStagedDiff(sd);
      fingerprintRef.current = workingTreeFingerprint(st);
      headRef.current = headCommitHash(hist);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  const refreshBackground = useCallback(async (): Promise<boolean> => {
    if (!repoPath || backgroundPauseRef.current > 0) return false;
    try {
      const [info, st, br] = await Promise.all([
        invoke<RepoInfo>("get_repo_info", { repoPath }),
        invoke<WorkingTreeStatus>("get_status", { repoPath }),
        invoke<BranchInfo[]>("get_branches", { repoPath }),
      ]);

      const fp = workingTreeFingerprint(st);
      const treeChanged = fp !== fingerprintRef.current;
      const syncMetaChanged =
        info.ahead !== repoInfo?.ahead ||
        info.behind !== repoInfo?.behind ||
        info.upstream_set !== repoInfo?.upstream_set ||
        info.current_branch !== repoInfo?.current_branch ||
        info.is_dirty !== repoInfo?.is_dirty;
      const needHistory =
        info.current_branch !== repoInfo?.current_branch ||
        info.total_commits !== repoInfo?.total_commits;

      setRepoInfo(info);
      setStatus(st);
      setBranches(br);

      let headChanged = false;
      if (needHistory) {
        const hist = await invoke<CommitInfo[]>("get_history", { repoPath, maxCount: 300 });
        const newHead = headCommitHash(hist);
        headChanged = newHead !== headRef.current;
        if (headChanged) {
          setCommits(hist);
          headRef.current = newHead;
        }
      }

      const filesChanged = treeChanged || headChanged;

      if (filesChanged) {
        const [wd, sd] = await Promise.all([
          invoke<DiffResult>("get_working_diff", { repoPath }),
          invoke<DiffResult>("get_staged_diff", { repoPath }),
        ]);
        setWorkingDiff(wd);
        setStagedDiff(sd);
        fingerprintRef.current = fp;
        return true;
      }

      fingerprintRef.current = fp;
      return syncMetaChanged;
    } catch {
      return false;
    }
  }, [repoPath, commits, repoInfo]);

  const openRepo = useCallback(async (path: string) => {
    await loadRepo(path);
  }, [loadRepo]);

  const selectCommit = useCallback(async (commit: CommitInfo | null) => {
    setSelectedCommit(commit);
    if (commit && repoPath) {
      try {
        const diff = await invoke<DiffResult>("get_commit_diff", {
          repoPath, commitHash: commit.hash,
        });
        setCommitDiff(diff);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } else {
      setCommitDiff(null);
    }
  }, [repoPath]);

  const stageFile = useCallback(async (path: string) => {
    if (!repoPath) return;
    await invoke("stage_file", { repoPath, filePath: path });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const unstageFile = useCallback(async (path: string) => {
    if (!repoPath) return;
    await invoke("unstage_file", { repoPath, filePath: path });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const stageAll = useCallback(async () => {
    if (!repoPath) return;
    await invoke("stage_all", { repoPath });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const unstageAll = useCallback(async () => {
    if (!repoPath) return;
    await invoke("unstage_all", { repoPath });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const createCommit = useCallback(
    async (message: string, sign = false) => {
      if (!repoPath) return;
      await invoke("create_commit", { repoPath, message, sign });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const checkoutBranch = useCallback(async (name: string) => {
    if (!repoPath) return;
    await invoke("checkout_branch", { repoPath, branchName: name });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const createBranch = useCallback(async (name: string) => {
    if (!repoPath) return;
    await invoke("create_branch", { repoPath, branchName: name });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const deleteBranch = useCallback(async (name: string) => {
    if (!repoPath) return;
    await invoke("delete_branch", { repoPath, branchName: name });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const renameBranch = useCallback(
    async (oldName: string, newName: string) => {
      if (!repoPath) return;
      await invoke("rename_branch", { repoPath, oldName, newName });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const mergeBranch = useCallback(
    async (branchName: string) => {
      if (!repoPath) throw new Error("No repository open");
      const result = await invoke<SyncResult>("merge_branch", { repoPath, branchName });
      await refreshAll();
      return result;
    },
    [repoPath, refreshAll]
  );

  const rebaseOnto = useCallback(
    async (upstreamBranch: string) => {
      if (!repoPath) throw new Error("No repository open");
      const result = await invoke<SyncResult>("rebase_onto", { repoPath, upstreamBranch });
      await refreshAll();
      return result;
    },
    [repoPath, refreshAll]
  );

  const rebaseAbort = useCallback(async () => {
    if (!repoPath) return;
    await invoke("rebase_abort", { repoPath });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const rebaseContinue = useCallback(async () => {
    if (!repoPath) throw new Error("No repository open");
    const result = await invoke<SyncResult>("rebase_continue", { repoPath });
    await refreshAll();
    return result;
  }, [repoPath, refreshAll]);

  const squashMergeBranch = useCallback(
    async (branchName: string) => {
      if (!repoPath) throw new Error("No repository open");
      const result = await invoke<SyncResult>("squash_merge_branch", { repoPath, branchName });
      await refreshAll();
      return result;
    },
    [repoPath, refreshAll]
  );

  const getBranchDiff = useCallback(
    async (baseBranch: string, compareBranch: string) => {
      if (!repoPath) throw new Error("No repository open");
      const diff = await invoke<DiffResult>("get_branch_diff", {
        repoPath,
        baseBranch,
        compareBranch,
      });
      setBranchCompareDiff(diff);
      return diff;
    },
    [repoPath]
  );

  const clearBranchCompareDiff = useCallback(() => {
    setBranchCompareDiff(null);
  }, []);

  const stageHunk = useCallback(
    async (patch: string) => {
      if (!repoPath) return;
      await invoke("stage_hunk", { repoPath, patch });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const unstageHunk = useCallback(
    async (patch: string) => {
      if (!repoPath) return;
      await invoke("unstage_hunk", { repoPath, patch });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const fetchRemote = useCallback(async () => {
    if (!repoPath) throw new Error("No repository open");
    return invoke<SyncResult>("fetch_remote", { repoPath });
  }, [repoPath]);

  const pullRemote = useCallback(async () => {
    if (!repoPath) throw new Error("No repository open");
    const result = await invoke<SyncResult>("pull_remote", { repoPath });
    await refreshAll();
    return result;
  }, [repoPath, refreshAll]);

  const pushRemote = useCallback(
    async (force = false) => {
      if (!repoPath) throw new Error("No repository open");
      const result = await invoke<SyncResult>("push_remote", { repoPath, force });
      await refreshAll();
      return result;
    },
    [repoPath, refreshAll]
  );

  const checkPushRequiresForce = useCallback(async () => {
    if (!repoPath) return false;
    return invoke<boolean>("check_push_requires_force", { repoPath });
  }, [repoPath]);

  const discardFile = useCallback(async (path: string) => {
    if (!repoPath) return;
    await invoke("discard_file_changes", { repoPath, filePath: path });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const discardAllChanges = useCallback(async () => {
    if (!repoPath) return;
    await invoke("discard_all_changes", { repoPath });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const getConflictDetail = useCallback(async (path: string) => {
    if (!repoPath) throw new Error("No repository open");
    return invoke<ConflictDetail>("get_conflict_detail", { repoPath, filePath: path });
  }, [repoPath]);

  const resolveConflict = useCallback(
    async (
      path: string,
      resolution: "ours" | "theirs" | "manual",
      content?: string
    ) => {
      if (!repoPath) return;
      await invoke("resolve_conflict", {
        repoPath,
        filePath: path,
        resolution,
        content: content ?? null,
      });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const abortMerge = useCallback(async () => {
    if (!repoPath) return;
    await invoke("abort_merge", { repoPath });
    await refreshAll();
  }, [repoPath, refreshAll]);

  const stashSave = useCallback(
    async (message?: string) => {
      if (!repoPath) return;
      await invoke("stash_save", { repoPath, message: message ?? null });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const stashPop = useCallback(
    async (stashIndex = 0) => {
      if (!repoPath) return;
      await invoke("stash_pop", { repoPath, stashIndex });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const stashApply = useCallback(
    async (stashIndex = 0) => {
      if (!repoPath) return;
      await invoke("stash_apply", { repoPath, stashIndex });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const stashDrop = useCallback(
    async (stashIndex = 0) => {
      if (!repoPath) return;
      await invoke("stash_drop", { repoPath, stashIndex });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const stashList = useCallback(async () => {
    if (!repoPath) return [];
    return invoke<StashEntry[]>("stash_list", { repoPath });
  }, [repoPath]);

  const getStashDiff = useCallback(
    async (stashIndex: number) => {
      if (!repoPath) throw new Error("No repository open");
      return invoke<DiffResult>("get_stash_diff", { repoPath, stashIndex });
    },
    [repoPath]
  );

  const amendCommit = useCallback(
    async (message?: string) => {
      if (!repoPath) return;
      await invoke("amend_commit", { repoPath, message: message ?? null });
      await refreshAll();
    },
    [repoPath, refreshAll]
  );

  const revertCommit = useCallback(
    async (commitHash: string) => {
      if (!repoPath) throw new Error("No repository open");
      const result = await invoke<RevertResult>("revert_commit", { repoPath, commitHash });
      await refreshAll();
      return result;
    },
    [repoPath, refreshAll]
  );

  const cherryPickCommit = useCallback(
    async (commitHash: string) => {
      if (!repoPath) throw new Error("No repository open");
      const result = await invoke<RevertResult>("cherry_pick_commit", { repoPath, commitHash });
      await refreshAll();
      return result;
    },
    [repoPath, refreshAll]
  );

  const openRepoFolder = useCallback(async () => {
    if (!repoPath) return;
    await invoke("open_repo_folder", { repoPath });
  }, [repoPath]);

  return (
    <GitContext.Provider value={{
      repoPath, repoHydrated, repoInfo, commits, status, branches,
      selectedCommit, commitDiff, workingDiff, stagedDiff, branchCompareDiff,
      loading, error,
      openRepo, refreshAll, refreshBackground, pauseBackgroundRefresh, resumeBackgroundRefresh,
      selectCommit,
      stageFile, unstageFile, stageAll, unstageAll,
      stageHunk, unstageHunk,
      createCommit, checkoutBranch, createBranch, deleteBranch, renameBranch, mergeBranch,
      rebaseOnto, rebaseAbort, rebaseContinue, squashMergeBranch,
      getBranchDiff, clearBranchCompareDiff,
      fetchRemote, pullRemote, pushRemote, checkPushRequiresForce,
      discardFile, discardAllChanges,
      getConflictDetail, resolveConflict, abortMerge,
      stashSave, stashPop, stashApply, stashDrop, stashList, getStashDiff,
      amendCommit, revertCommit, cherryPickCommit, openRepoFolder,
    }}>
      {children}
    </GitContext.Provider>
  );
}
