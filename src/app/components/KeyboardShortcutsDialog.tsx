"use client";

import React, { useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { menuShortcut } from "@/lib/menu-shortcuts";
import { APP_NAME } from "@/lib/app-meta";

const REPO_SHORTCUTS: { label: string; keys: string }[] = [
  { label: "New branch…", keys: "Ctrl+Shift+N" },
  { label: "Rename branch…", keys: "Ctrl+Shift+R" },
  { label: "Delete branch…", keys: "Ctrl+Shift+D" },
  { label: "Discard all changes…", keys: "Ctrl+Shift+Backspace" },
  { label: "Stash all changes", keys: "Ctrl+Shift+S" },
  { label: "Update from main", keys: "Ctrl+Shift+U" },
  { label: "Compare to branch", keys: "Ctrl+Shift+B" },
  { label: "Merge into current branch…", keys: "Ctrl+Shift+M" },
  { label: "Compare on GitHub", keys: "Ctrl+Shift+C" },
  { label: "View branch on GitHub", keys: "Alt+Ctrl+B" },
  { label: "Create pull request", keys: "Ctrl+R" },
  { label: "Squash and merge into current", keys: "Ctrl+Shift+H" },
  { label: "Rebase current branch", keys: "Ctrl+Shift+E" },
  { label: "Fetch origin", keys: "Ctrl+Shift+T" },
  { label: "Pull", keys: "Ctrl+Shift+L" },
  { label: "Push", keys: "Ctrl+Shift+P" },
  { label: "Preview pull request", keys: "Alt+Ctrl+P" },
  { label: "Command palette", keys: "Ctrl+K" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ open, onClose }: Props) {
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
        className={`aero-modal aero-shortcuts${visible ? " aero-modal--visible" : ""}`}
        role="dialog"
        aria-labelledby="shortcuts-dialog-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="aero-modal__header">
          <div className="aero-modal__title-row">
            <Keyboard size={18} style={{ color: "var(--aero-sky)", flexShrink: 0 }} />
            <h2 id="shortcuts-dialog-title">Keyboard shortcuts</h2>
          </div>
          <button type="button" className="ghd-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <p className="aero-settings__hint">
          Repository shortcuts work while a repo is open in {APP_NAME}.
        </p>

        <table className="aero-shortcuts__table">
          <tbody>
            {REPO_SHORTCUTS.map((row) => (
              <tr key={row.keys}>
                <td>{row.label}</td>
                <td>
                  <kbd>{menuShortcut(row.keys)}</kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="aero-modal__footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
