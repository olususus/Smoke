"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GitBranch, X } from "lucide-react";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useSettings } from "../context/SettingsContext";
import type { BranchInfo } from "../context/GitContext";

export interface BranchPickerOptions {
  title: string;
  description?: string;
  excludeCurrent?: boolean;
  localsOnly?: boolean;
}

interface Props {
  open: boolean;
  options: BranchPickerOptions | null;
  branches: BranchInfo[];
  currentBranch: string;
  onSelect: (branchName: string) => void;
  onClose: () => void;
}

export function BranchPickerDialog({
  open,
  options,
  branches,
  currentBranch,
  onSelect,
  onClose,
}: Props) {
  const { motionDurationMs } = useSettings();
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (open) setFilter("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    let list = branches;
    if (options?.localsOnly) {
      list = list.filter((b) => !b.is_remote);
    }
    if (options?.excludeCurrent) {
      list = list.filter((b) => b.name !== currentBranch);
    }
    const q = filter.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => b.name.toLowerCase().includes(q));
    }
    return list;
  }, [branches, options, currentBranch, filter]);

  if (!mounted || !options) return null;

  return (
    <div
      className={`aero-modal-backdrop${visible ? " aero-modal-backdrop--visible" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`aero-modal${visible ? " aero-modal--visible" : ""}`}
        role="dialog"
        aria-labelledby="branch-picker-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, maxHeight: "70vh", display: "flex", flexDirection: "column" }}
      >
        <header className="aero-modal__header">
          <div className="aero-modal__title-row">
            <GitBranch size={18} style={{ color: "var(--aero-sky)", flexShrink: 0 }} />
            <h2 id="branch-picker-title">{options.title}</h2>
          </div>
          <button type="button" className="ghd-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {options.description && (
          <p style={{ padding: "0 16px 8px", margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
            {options.description}
          </p>
        )}

        <div style={{ padding: "0 16px 8px" }}>
          <input
            className="ghd-filter-input"
            style={{ width: "100%", padding: "8px 10px" }}
            placeholder="Filter branches…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
        </div>

        <ul
          className="branch-picker-list"
          style={{
            flex: 1,
            overflow: "auto",
            margin: 0,
            padding: "4px 8px 12px",
            listStyle: "none",
          }}
        >
          {filtered.length === 0 && (
            <li style={{ padding: 16, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              No branches match
            </li>
          )}
          {filtered.map((b) => (
            <li key={b.name}>
              <button
                type="button"
                className="branch-picker-item"
                onClick={() => onSelect(b.name)}
              >
                <span className="branch-picker-item__name">{b.name}</span>
                {b.is_head && (
                  <span className="branch-picker-item__badge">current</span>
                )}
                {b.last_commit_summary && (
                  <span className="branch-picker-item__meta">{b.last_commit_summary}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
