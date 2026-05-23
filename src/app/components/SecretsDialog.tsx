"use client";

import React from "react";
import { AlertTriangle, X, ChevronRight } from "lucide-react";
import type { SecretFinding } from "@/lib/collect-secrets";
import { useSettings } from "../context/SettingsContext";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";

interface Props {
  open: boolean;
  findings: SecretFinding[];
  onClose: () => void;
  onNavigate?: (finding: SecretFinding) => void;
}

const sectionLabel: Record<SecretFinding["section"], string> = {
  staged: "Staged",
  working: "Unstaged",
  commit: "Commit",
};

export function SecretsDialog({ open, findings, onClose, onNavigate }: Props) {
  const { motionDurationMs } = useSettings();
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);

  if (!mounted) return null;

  return (
    <div
      className={`aero-modal-backdrop${visible ? " aero-modal-backdrop--visible" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`aero-modal secrets-dialog${visible ? " aero-modal--visible" : ""}`}
        role="dialog"
        aria-labelledby="secrets-dialog-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="secrets-dialog__header">
          <div className="secrets-dialog__title-row">
            <AlertTriangle size={18} style={{ color: "var(--danger)", flexShrink: 0 }} />
            <h2 id="secrets-dialog-title">
              {findings.length} potential secret{findings.length === 1 ? "" : "s"} detected
            </h2>
          </div>
          <button type="button" className="ghd-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <p className="secrets-dialog__hint">
          These lines look like API keys, tokens, or passwords. Remove them from the commit or rotate
          the credential before pushing. Click a finding to jump to it in the diff.
        </p>

        <div className="secrets-dialog__list">
          {findings.length === 0 ? (
            <p className="secrets-dialog__empty">No secrets in the current view.</p>
          ) : (
            findings.map((f) => (
              <button
                key={f.id}
                type="button"
                className="secrets-dialog__item"
                onClick={() => {
                  onNavigate?.(f);
                  onClose();
                }}
              >
                <div className="secrets-dialog__item-top">
                  <span className="secrets-dialog__file">{f.file}</span>
                  {f.line != null && (
                    <span className="secrets-dialog__line">line {f.line}</span>
                  )}
                  <span className="secrets-dialog__badge">{sectionLabel[f.section]}</span>
                  <ChevronRight size={14} className="secrets-dialog__goto" />
                </div>
                {f.secretType && (
                  <div className="secrets-dialog__type">{f.secretType}</div>
                )}
                <code className="secrets-dialog__preview">{f.preview}</code>
              </button>
            ))
          )}
        </div>

        <footer className="secrets-dialog__footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}
