"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGit } from "../context/GitContext";
import { ChevronDown, GitBranch } from "lucide-react";
import { DropdownPortal } from "./DropdownPortal";

interface Props {
  variant?: "compact" | "toolbar";
  openCreateSignal?: number;
  /** When set, only one toolbar dropdown can be open at a time (repo page). */
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}

export function BranchSelector({
  variant = "compact",
  openCreateSignal,
  menuOpen,
  onMenuOpenChange,
}: Props) {
  const { branches, repoInfo, checkoutBranch, createBranch } = useGit();
  const [openInternal, setOpenInternal] = useState(false);
  const controlled = onMenuOpenChange !== undefined;
  const open = controlled ? (menuOpen ?? false) : openInternal;
  const setOpen = (next: boolean) => {
    if (controlled) onMenuOpenChange(next);
    else setOpenInternal(next);
  };
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);

  const currentBranch = repoInfo?.current_branch ?? "main";

  useEffect(() => {
    if (!openCreateSignal) return;
    const id = window.setTimeout(() => {
      setOpen(true);
      setCreating(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [openCreateSignal]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createBranch(newName.trim());
    setNewName("");
    setCreating(false);
    setOpen(false);
  };

  const localBranches = branches.filter((b) => !b.is_remote);
  const filtered = localBranches.filter((b) =>
    b.name.toLowerCase().includes(filter.toLowerCase())
  );

  const close = () => {
    setOpen(false);
    setCreating(false);
    setFilter("");
  };

  const dropdown = (
    <>
      <div className="gh-dropdown-header">Branches</div>
      <div style={{ padding: 8 }}>
        <input
          className="login-pat-input"
          style={{ width: "100%" }}
          placeholder="Filter branches…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div style={{ maxHeight: 220, overflow: "auto" }}>
        {filtered.map((b) => (
          <button
            key={b.name}
            type="button"
            className="gh-dropdown-item"
            onClick={() => {
              void checkoutBranch(b.name);
              close();
            }}
          >
            {b.is_head ? "✓ " : ""}
            {b.name}
            {!b.is_remote && !b.upstream && (
              <span className="gh-branch-unpublished" title="Not published to origin">
                unpublished
              </span>
            )}
          </button>
        ))}
      </div>
      <div style={{ padding: 8, borderTop: "1px solid var(--gh-border)" }}>
        {creating ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="login-pat-input"
              style={{ flex: 1 }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Branch name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
                if (e.key === "Escape") setCreating(false);
              }}
            />
            <button type="button" className="btn btn-primary" onClick={() => void handleCreate()}>
              Create
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="gh-dropdown-item"
            onClick={() => setCreating(true)}
          >
            New branch…
          </button>
        )}
      </div>
    </>
  );

  if (variant === "toolbar") {
    return (
      <>
        <button
          ref={anchorRef}
          type="button"
          className={`gh-toolbar-section${open ? " gh-toolbar-section--open" : ""}`}
          onClick={() => setOpen(!open)}
        >
          <GitBranch size={16} className="gh-toolbar-section-icon" />
          <div className="gh-toolbar-section-body">
            <span className="gh-toolbar-label">Current branch</span>
            <span className="gh-toolbar-value">{currentBranch}</span>
          </div>
          <ChevronDown size={14} className="gh-toolbar-chevron" />
        </button>
        <DropdownPortal open={open} onClose={close} anchorRef={anchorRef}>
          {dropdown}
        </DropdownPortal>
      </>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        style={styles.trigger}
      >
        <GitBranch size={12} style={{ color: "var(--glow-blue-bright)" }} />
        <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{currentBranch}</span>
        <ChevronDown size={12} style={{ color: "var(--text-tertiary)" }} />
      </button>
      <DropdownPortal open={open} onClose={close} anchorRef={anchorRef}>
        {dropdown}
      </DropdownPortal>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 6,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--void-border)",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
