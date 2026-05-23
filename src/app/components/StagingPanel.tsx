"use client";

import React, { useState } from "react";
import { useGit } from "../context/GitContext";
import { Plus, Minus, FileCode, Check, ChevronDown, ChevronRight, AlertTriangle, Send } from "lucide-react";

export function StagingPanel() {
  const git = useGit();
  const [commitMsg, setCommitMsg] = useState("");
  const [expandSections, setExpandSections] = useState({ staged: true, unstaged: true, untracked: true });

  if (!git.status) return null;
  const { staged, unstaged, untracked, conflicts } = git.status;
  const secretCount = (git.workingDiff?.total_secrets ?? 0) + (git.stagedDiff?.total_secrets ?? 0);

  const toggle = (s: keyof typeof expandSections) => setExpandSections(p => ({ ...p, [s]: !p[s] }));

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    try {
      await git.createCommit(commitMsg.trim());
      setCommitMsg("");
    } catch { /* error shown via context */ }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case "new": case "untracked": return <Plus size={12} style={{ color: "var(--success)" }} />;
      case "modified": return <FileCode size={12} style={{ color: "var(--warning)" }} />;
      case "deleted": return <Minus size={12} style={{ color: "var(--danger)" }} />;
      default: return <FileCode size={12} style={{ color: "var(--text-tertiary)" }} />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {secretCount > 0 && (
        <div className="animate-secret-pulse" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--danger-muted)", borderBottom: "1px solid rgba(244,63,94,0.2)", fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>
          <AlertTriangle size={14} /> {secretCount} secret{secretCount > 1 ? "s" : ""} detected in changes
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
        {staged.length > 0 && (
          <FileSection title={`Staged (${staged.length})`} expanded={expandSections.staged} onToggle={() => toggle("staged")} color="var(--success)">
            {staged.map(f => (
              <FileRow key={f.path} file={f} icon={statusIcon(f.status)} action={<button style={styles.actionBtn} onClick={() => git.unstageFile(f.path)} title="Unstage"><Minus size={12} /></button>} />
            ))}
          </FileSection>
        )}

        {unstaged.length > 0 && (
          <FileSection title={`Modified (${unstaged.length})`} expanded={expandSections.unstaged} onToggle={() => toggle("unstaged")} color="var(--warning)">
            {unstaged.map(f => (
              <FileRow key={f.path} file={f} icon={statusIcon(f.status)} action={<button style={styles.actionBtn} onClick={() => git.stageFile(f.path)} title="Stage"><Plus size={12} /></button>} />
            ))}
          </FileSection>
        )}

        {untracked.length > 0 && (
          <FileSection title={`Untracked (${untracked.length})`} expanded={expandSections.untracked} onToggle={() => toggle("untracked")} color="var(--text-tertiary)">
            {untracked.map(f => (
              <FileRow key={f.path} file={f} icon={statusIcon(f.status)} action={<button style={styles.actionBtn} onClick={() => git.stageFile(f.path)} title="Stage"><Plus size={12} /></button>} />
            ))}
          </FileSection>
        )}

        {conflicts.length > 0 && (
          <FileSection title={`Conflicts (${conflicts.length})`} expanded={true} onToggle={() => {}} color="var(--danger)">
            {conflicts.map(f => <FileRow key={f.path} file={f} icon={<AlertTriangle size={12} style={{ color: "var(--danger)" }} />} />)}
          </FileSection>
        )}

        {git.status.is_clean && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50%", gap: 8, color: "var(--text-tertiary)", fontSize: 13 }}>
            <Check size={24} style={{ color: "var(--success)" }} />
            Working tree clean
          </div>
        )}
      </div>

      {!git.status.is_clean && (
        <div style={{ display: "flex", gap: 4, padding: "6px 12px", borderTop: "1px solid var(--void-border)" }}>
          {(unstaged.length > 0 || untracked.length > 0) && (
            <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11, padding: "5px 8px" }} onClick={git.stageAll}>Stage All</button>
          )}
          {staged.length > 0 && (
            <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11, padding: "5px 8px" }} onClick={git.unstageAll}>Unstage All</button>
          )}
        </div>
      )}

      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--void-border)", background: "var(--void-deep)" }}>
        <textarea
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          placeholder="Commit message..."
          style={styles.commitInput}
          rows={3}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCommit(); }}
        />
        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 6, fontSize: 13, padding: "8px 16px", opacity: commitMsg.trim() && staged.length > 0 ? 1 : 0.4 }}
          onClick={handleCommit}
          disabled={!commitMsg.trim() || staged.length === 0}
        >
          <Send size={14} /> Commit {staged.length > 0 && `(${staged.length} file${staged.length > 1 ? "s" : ""})`}
        </button>
      </div>
    </div>
  );
}

function FileSection({ title, expanded, onToggle, color, children }: { title: string; expanded: boolean; onToggle: () => void; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={onToggle} style={{ ...styles.sectionHeader, color }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {expanded && children}
    </div>
  );
}

function FileRow({ file, icon, action }: { file: { path: string; status: string }; icon: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={styles.fileRow}>
      {icon}
      <span style={styles.filePath}>{file.path}</span>
      {action}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sectionHeader: { display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "6px 12px", background: "none", border: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", fontFamily: "inherit" },
  fileRow: { display: "flex", alignItems: "center", gap: 8, padding: "4px 12px 4px 28px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", transition: "background 100ms" },
  filePath: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-jetbrains)", fontSize: 11 },
  actionBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 4, background: "rgba(255,255,255,0.04)", border: "1px solid var(--void-border)", color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0 },
  commitInput: { width: "100%", padding: "8px 10px", background: "rgba(19,19,26,0.6)", border: "1px solid var(--void-border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none" },
};
