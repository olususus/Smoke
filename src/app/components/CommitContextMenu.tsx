"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { CommitInfo } from "../context/GitContext";

export interface CommitContextMenuProps {
  commit: CommitInfo;
  open: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  canAmend: boolean;
  viewOnGitHubDisabled?: boolean;
  onAmend: () => void;
  onRevert: () => void;
  onCherryPick: () => void;
  onViewOnGitHub: () => void;
}

export function CommitContextMenu({
  commit,
  open,
  position,
  onClose,
  canAmend,
  viewOnGitHubDisabled,
  onAmend,
  onRevert,
  onCherryPick,
  onViewOnGitHub,
}: CommitContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const left = Math.min(position.x, window.innerWidth - 260);
  const top = Math.min(position.y, window.innerHeight - 200);

  return createPortal(
    <>
      <div className="gh-context-menu-backdrop" onMouseDown={onClose} />
      <div
        ref={menuRef}
        className="gh-context-menu"
        style={{ top, left }}
        role="menu"
      >
        <button
          type="button"
          className="gh-context-menu__item"
          role="menuitem"
          disabled={!canAmend}
          title={canAmend ? undefined : "Only the latest commit can be amended"}
          onClick={() => {
            onAmend();
            onClose();
          }}
        >
          Amend commit…
        </button>
        <button
          type="button"
          className="gh-context-menu__item"
          role="menuitem"
          onClick={() => {
            onRevert();
            onClose();
          }}
        >
          Revert changes in commit…
        </button>
        <button
          type="button"
          className="gh-context-menu__item"
          role="menuitem"
          onClick={() => {
            onCherryPick();
            onClose();
          }}
        >
          Cherry-pick commit…
        </button>
        <div className="gh-dropdown-divider" />
        <button
          type="button"
          className="gh-context-menu__item"
          role="menuitem"
          disabled={viewOnGitHubDisabled}
          onClick={() => {
            onViewOnGitHub();
            onClose();
          }}
        >
          View on GitHub
        </button>
      </div>
    </>,
    document.body
  );
}
