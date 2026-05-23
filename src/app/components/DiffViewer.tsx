"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DiffResult, DiffLine, useGit } from "../context/GitContext";
import { AlertTriangle, Eye, EyeOff, ChevronRight, Plus, Minus } from "lucide-react";
import { buildHunkPatch } from "@/lib/build-hunk-patch";
import { highlightDiffSegments } from "@/lib/diff-highlight";
import { FormattedText } from "./FormattedText";
import { parseGitHubRemote } from "@/lib/github-url";
import { collectSecretsFromDiffs, type SecretFinding } from "@/lib/collect-secrets";
import { SecretsDialog } from "./SecretsDialog";

export interface DiffScrollTarget {
  file: string;
  line: number | null;
  hunkIndex: number;
  lineIndex: number;
  lineKey: string;
}

interface Props {
  diff: DiffResult | null;
  stagedDiff?: DiffResult | null;
  remoteUrl?: string | null;
  secretScope?: {
    working?: DiffResult | null;
    staged?: DiffResult | null;
    commit?: DiffResult | null;
  };
  scrollTarget?: DiffScrollTarget | null;
  onScrollTargetDone?: () => void;
  onSecretNavigate?: (finding: SecretFinding) => void;
  /** Show stage/unstage hunk controls (changes tab). */
  enableHunkStaging?: boolean;
}

export function DiffViewer({
  diff,
  stagedDiff,
  remoteUrl = null,
  secretScope,
  scrollTarget,
  onScrollTargetDone,
  onSecretNavigate,
  enableHunkStaging = false,
}: Props) {
  const { selectedCommit, commitDiff, stageHunk, unstageHunk } = useGit();
  const rootRef = useRef<HTMLDivElement>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [secretsOpen, setSecretsOpen] = useState(false);

  const allFiles = [
    ...(stagedDiff?.files ?? []).map((f) => ({ ...f, section: "staged" as const })),
    ...(diff?.files ?? []).map((f) => ({ ...f, section: "working" as const })),
  ];

  const showCommitHeader = selectedCommit && !stagedDiff && diff;
  const ghRepo = parseGitHubRemote(remoteUrl);

  const secretFindings = useMemo(
    () =>
      collectSecretsFromDiffs(
        secretScope?.working ?? diff,
        secretScope?.staged ?? stagedDiff,
        secretScope?.commit ?? commitDiff
      ),
    [secretScope, diff, stagedDiff, commitDiff]
  );

  const totalSecrets = secretFindings.length;

  const toggleSecret = (key: string) => {
    setRevealedSecrets((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  useEffect(() => {
    if (!scrollTarget) return;
    setRevealedSecrets((prev) => new Set(prev).add(scrollTarget.lineKey));
    const t = window.setTimeout(() => {
      const el = rootRef.current?.querySelector(
        `[data-diff-line="${scrollTarget.lineKey}"]`
      );
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      onScrollTargetDone?.();
    }, 80);
    return () => window.clearTimeout(t);
  }, [scrollTarget, onScrollTargetDone]);

  const handleSecretNavigate = (finding: SecretFinding) => {
    if (onSecretNavigate) {
      onSecretNavigate(finding);
      return;
    }
    const lineKey = `${finding.file}-${finding.hunkIndex}-${finding.lineIndex}`;
    setRevealedSecrets((prev) => new Set(prev).add(lineKey));
    const el = rootRef.current?.querySelector(`[data-diff-line="${lineKey}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  if (allFiles.length === 0 && !showCommitHeader) {
    return <div className="gh-empty-state">No diff to display</div>;
  }

  return (
    <div ref={rootRef} style={{ height: "100%", overflow: "auto" }}>
      {showCommitHeader && selectedCommit && diff && (
        <header className="diff-commit-header">
          <h2 className="diff-commit-title">
            <FormattedText
              text={selectedCommit.summary}
              repoOwner={ghRepo?.owner}
              repoName={ghRepo?.repo}
            />
          </h2>
          {selectedCommit.message.replace(selectedCommit.summary, "").trim() && (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", marginBottom: 12 }}>
              <FormattedText
                text={selectedCommit.message.replace(selectedCommit.summary, "").trim()}
                repoOwner={ghRepo?.owner}
                repoName={ghRepo?.repo}
              />
            </p>
          )}
          <div className="diff-commit-meta">
            <span>{selectedCommit.author_name}</span>
            <span>·</span>
            <span>{new Date(selectedCommit.timestamp * 1000).toLocaleString()}</span>
            <span className="diff-commit-stats">
              <span className="diff-stat-add">+{diff.total_additions}</span>{" "}
              <span className="diff-stat-del">−{diff.total_deletions}</span>
            </span>
            <span style={{ fontFamily: "var(--font-jetbrains)", color: "var(--text-link)" }}>
              {selectedCommit.short_hash}
            </span>
          </div>
        </header>
      )}

      {totalSecrets > 0 && (
        <button
          type="button"
          className="secrets-banner"
          onClick={() => setSecretsOpen(true)}
        >
          <AlertTriangle size={14} />
          <span>
            {totalSecrets} potential secret{totalSecrets > 1 ? "s" : ""} detected
          </span>
          <ChevronRight size={14} className="secrets-banner__chevron" />
        </button>
      )}

      <SecretsDialog
        open={secretsOpen}
        findings={secretFindings}
        onClose={() => setSecretsOpen(false)}
        onNavigate={handleSecretNavigate}
      />

      {allFiles.map((file, i) => (
        <div key={file.path + i}>
          <div className="diff-file-header">
            <span style={{ flex: 1 }}>{file.path}</span>
            {file.has_secrets && <AlertTriangle size={12} style={{ color: "var(--danger)" }} />}
            <span className="diff-stat-add">+{file.additions}</span>
            <span className="diff-stat-del">−{file.deletions}</span>
          </div>

          {file.binary ? (
            <div className="gh-empty-state" style={{ minHeight: 80 }}>
              Binary file
            </div>
          ) : (
            file.hunks.map((hunk, hi) => (
              <div key={hi} className="diff-hunk">
                <div className="diff-hunk-header">
                  <span>{hunk.header}</span>
                  {enableHunkStaging && !file.binary && (
                    <span className="diff-hunk-actions">
                      <button
                        type="button"
                        className="diff-hunk-btn"
                        title="Stage hunk"
                        onClick={() => {
                          const patch = buildHunkPatch(file.path, hunk);
                          void stageHunk(patch);
                        }}
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        className="diff-hunk-btn"
                        title="Unstage hunk"
                        onClick={() => {
                          const patch = buildHunkPatch(file.path, hunk);
                          void unstageHunk(patch);
                        }}
                      >
                        <Minus size={12} />
                      </button>
                    </span>
                  )}
                </div>
                {hunk.lines.map((line, li) => {
                  const lineKey = `${file.path}-${hi}-${li}`;
                  const isHighlight =
                    scrollTarget?.lineKey === lineKey ||
                    (scrollTarget?.file === file.path &&
                      scrollTarget.hunkIndex === hi &&
                      scrollTarget.lineIndex === li);
                  return (
                    <DiffLineRow
                      key={li}
                      line={line}
                      filePath={file.path}
                      lineKey={lineKey}
                      highlighted={isHighlight}
                      revealed={revealedSecrets.has(lineKey)}
                      onToggleSecret={toggleSecret}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function DiffLineRow({
  line,
  filePath,
  lineKey,
  highlighted,
  revealed,
  onToggleSecret,
}: {
  line: DiffLine;
  filePath: string;
  lineKey: string;
  highlighted?: boolean;
  revealed: boolean;
  onToggleSecret: (k: string) => void;
}) {
  const lineClass =
    line.origin === "+"
      ? "diff-line diff-line--add"
      : line.origin === "-"
        ? "diff-line diff-line--del"
        : "diff-line";

  const raw = line.is_secret && !revealed ? line.content.replace(/\S/g, "•") : line.content;
  const segments = line.is_secret && !revealed ? [{ text: raw }] : highlightDiffSegments(raw, filePath);

  return (
    <div
      className={`${lineClass}${highlighted ? " diff-line--highlight" : ""}${line.is_secret ? " diff-line--secret" : ""}`}
      data-diff-line={lineKey}
    >
      <span className="diff-lineno">{line.old_lineno ?? ""}</span>
      <span className="diff-lineno">{line.new_lineno ?? ""}</span>
      <span
        className={`diff-sign${line.origin === "+" ? " diff-sign--add" : line.origin === "-" ? " diff-sign--del" : ""}`}
      >
        {line.origin.trim()}
      </span>
      <pre className="diff-content">
        {segments.map((seg, i) =>
          seg.keyword ? (
            <span key={i} className="diff-hl-keyword">
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </pre>
      {line.is_secret && (
        <button
          type="button"
          onClick={() => onToggleSecret(lineKey)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "0 8px" }}
          aria-label={revealed ? "Hide secret" : "Reveal secret"}
        >
          {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      )}
    </div>
  );
}
