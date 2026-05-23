"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseGitHubRemote } from "@/lib/github-url";
import { formatGithubApiError } from "@/lib/github-api";
import {
  listPullRequests,
  getPullRequest,
  listPullComments,
  listPullFiles,
  listCheckRuns,
  mergePullRequest,
  type PullRequestSummary,
  type PullRequestComment,
  type PullRequestFile,
  type CheckRun,
} from "@/lib/github-pulls";

export function usePullRequests(remoteUrl: string | null) {
  const gh = useMemo(() => parseGitHubRemote(remoteUrl), [remoteUrl]);
  const owner = gh?.owner ?? "";
  const repo = gh?.repo ?? "";

  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<(PullRequestSummary & { body?: string }) | null>(null);
  const [comments, setComments] = useState<PullRequestComment[]>([]);
  const [files, setFiles] = useState<PullRequestFile[]>([]);
  const [checks, setChecks] = useState<CheckRun[]>([]);
  const [checksError, setChecksError] = useState<string | null>(null);

  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const loadList = useCallback(async () => {
    if (!owner || !repo) return;
    setListLoading(true);
    setListError(null);
    try {
      const list = await listPullRequests(owner, repo);
      setPrs(list);
    } catch (e: unknown) {
      setListError(formatGithubApiError(e));
      setPrs([]);
    } finally {
      setListLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => {
    if (gh) void loadList();
  }, [gh, loadList]);

  const loadDetail = useCallback(
    async (num: number) => {
      if (!owner || !repo) return;
      setDetailLoading(true);
      setDetailError(null);
      setChecksError(null);
      try {
        const pr = await getPullRequest(owner, repo, num);
        const [cmtsResult, filesResult, checksResult] = await Promise.allSettled([
          listPullComments(owner, repo, num),
          listPullFiles(owner, repo, num),
          pr.head?.sha
            ? listCheckRuns(owner, repo, pr.head.sha)
            : Promise.resolve([] as CheckRun[]),
        ]);

        setDetail(pr);

        if (cmtsResult.status === "fulfilled") setComments(cmtsResult.value);
        else setComments([]);

        if (filesResult.status === "fulfilled") setFiles(filesResult.value);
        else setFiles([]);

        if (checksResult.status === "fulfilled") {
          setChecks(checksResult.value);
        } else {
          setChecks([]);
          setChecksError(formatGithubApiError(checksResult.reason));
        }
      } catch (e: unknown) {
        setDetailError(formatGithubApiError(e));
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [owner, repo]
  );

  const selectPr = useCallback(
    (num: number) => {
      setSelected(num);
      void loadDetail(num);
    },
    [loadDetail]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return prs;
    return prs.filter(
      (p) => p.title.toLowerCase().includes(q) || String(p.number).includes(q)
    );
  }, [prs, filter]);

  const handleMerge = useCallback(
    async (method: "merge" | "squash" | "rebase") => {
      if (!owner || !repo || selected == null) return;
      await mergePullRequest(owner, repo, selected, method);
      setMergeOpen(false);
      await loadList();
      setSelected(null);
      setDetail(null);
    },
    [owner, repo, selected, loadList]
  );

  return {
    gh,
    owner,
    repo,
    prs,
    filtered,
    selected,
    detail,
    comments,
    files,
    checks,
    checksError,
    listLoading,
    detailLoading,
    listError,
    detailError,
    mergeOpen,
    setMergeOpen,
    filter,
    setFilter,
    loadList,
    selectPr,
    handleMerge,
  };
}

export type PullRequestInbox = ReturnType<typeof usePullRequests>;
