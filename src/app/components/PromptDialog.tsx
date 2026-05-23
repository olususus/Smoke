"use client";

import React, { useEffect, useState } from "react";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useSettings } from "../context/SettingsContext";

export function PromptDialog({
  open,
  title,
  label,
  defaultValue = "",
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const { motionDurationMs } = useSettings();
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

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
        aria-labelledby="prompt-dialog-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 400 }}
      >
        <header className="aero-modal__header">
          <h2 id="prompt-dialog-title">{title}</h2>
        </header>
        <div className="aero-modal__body" style={{ padding: "8px 16px 16px" }}>
          <label className="aero-settings__label" htmlFor="prompt-dialog-input">
            {label}
          </label>
          <input
            id="prompt-dialog-input"
            className="ghd-filter-input"
            style={{ width: "100%", marginTop: 6, padding: "8px 10px" }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onConfirm(value.trim());
              }
            }}
            autoFocus
          />
        </div>
        <footer className="aero-modal__footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onConfirm(value.trim())}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
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
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <header className="aero-modal__header">
          <h2 id="confirm-dialog-title">{title}</h2>
        </header>
        <p style={{ padding: "0 16px 16px", fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          {message}
        </p>
        <footer className="aero-modal__footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={danger ? { background: "var(--danger)", borderColor: "var(--danger)" } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
