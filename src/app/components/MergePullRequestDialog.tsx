"use client";

import React, { useEffect } from "react";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useSettings } from "../context/SettingsContext";

interface Props {
  open: boolean;
  prNumber: number;
  onClose: () => void;
  onMerge: (method: "merge" | "squash" | "rebase") => void;
}

export function MergePullRequestDialog({ open, prNumber, onClose, onMerge }: Props) {
  const { motionDurationMs } = useSettings();
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`aero-modal-backdrop${visible ? " aero-modal-backdrop--visible" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`aero-modal${visible ? " aero-modal--visible" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 400 }}
      >
        <header className="aero-modal__header">
          <h2>Merge pull request #{prNumber}</h2>
        </header>
        <div className="aero-modal__body" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
          <button type="button" className="btn btn-primary" onClick={() => onMerge("merge")}>
            Create merge commit
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onMerge("squash")}>
            Squash and merge
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onMerge("rebase")}>
            Rebase and merge
          </button>
        </div>
        <footer className="aero-modal__footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
