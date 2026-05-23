"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useSettings } from "../context/SettingsContext";
import type { BranchInfo } from "../context/GitContext";

interface Action {
  id: string;
  label: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  remoteUrl: string | null;
  currentBranch: string;
  branches: BranchInfo[];
  onSelectTab: (tab: "changes" | "history" | "pulls") => void;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onNewBranch: () => void;
  onOpenRepoSettings: () => void;
}

export function CommandPalette({
  open,
  onClose,
  currentBranch,
  branches,
  onSelectTab,
  onFetch,
  onPull,
  onPush,
  onNewBranch,
  onOpenRepoSettings,
}: Props) {
  const { motionDurationMs } = useSettings();
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const actions: Action[] = useMemo(
    () => [
      { id: "changes", label: "Go to Changes", run: () => onSelectTab("changes") },
      { id: "history", label: "Go to History", run: () => onSelectTab("history") },
      { id: "pulls", label: "Go to Pull requests", run: () => onSelectTab("pulls") },
      { id: "fetch", label: "Fetch origin", run: onFetch },
      { id: "pull", label: "Pull", run: onPull },
      { id: "push", label: "Push", run: onPush },
      { id: "branch", label: "New branch…", run: onNewBranch },
      { id: "settings", label: "Repository settings…", run: onOpenRepoSettings },
      ...branches
        .filter((b) => !b.is_remote)
        .map((b) => ({
          id: `checkout-${b.name}`,
          label: `Checkout ${b.name}${b.name === currentBranch ? " (current)" : ""}`,
          run: () => {
            /* checkout handled by parent if wired */
          },
        })),
    ],
    [branches, currentBranch, onSelectTab, onFetch, onPull, onPush, onNewBranch, onOpenRepoSettings]
  );

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.trim().toLowerCase())
  );

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
      className={`aero-modal-backdrop command-palette-backdrop${visible ? " aero-modal-backdrop--visible" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`command-palette${visible ? " command-palette--visible" : ""}`}
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="command-palette__input"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered[0]) {
              filtered[0].run();
              onClose();
            }
          }}
        />
        <ul className="command-palette__list">
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="command-palette__item"
                onClick={() => {
                  a.run();
                  onClose();
                }}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
