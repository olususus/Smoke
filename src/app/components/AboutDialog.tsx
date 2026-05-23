"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { AppLogo } from "./AppLogo";
import { BetaBanner } from "./BetaBanner";
import { useSettings } from "../context/SettingsContext";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import {
  APP_CREATOR,
  APP_NAME,
  APP_REPO_URL,
  APP_VERSION_FALLBACK,
  getAppVersion,
} from "@/lib/app-meta";
import { openExternalUrl } from "@/lib/open-external";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: Props) {
  const { motionDurationMs } = useSettings();
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);
  const [version, setVersion] = useState(APP_VERSION_FALLBACK);

  useEffect(() => {
    if (!open) return;
    void getAppVersion().then(setVersion);
  }, [open]);

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
      className={`ghd-modal-backdrop ghd-modal-backdrop--motion${visible ? " ghd-modal-backdrop--visible" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`ghd-modal ghd-about-modal${visible ? " ghd-about-modal--visible" : ""}`}
        role="dialog"
        aria-labelledby="about-dialog-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ghd-modal-header">
          <h2 id="about-dialog-title">About {APP_NAME}</h2>
          <button type="button" className="ghd-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="ghd-about-modal__body">
          <AppLogo size={56} className="ghd-about-modal__logo" />
          <p className="ghd-about-modal__tagline">
            A Git client for Linux with secret-aware commits.
          </p>

          <BetaBanner variant="inline" className="ghd-about-modal__beta" />

          <dl className="ghd-settings-meta ghd-about-modal__meta">
            <div className="ghd-settings-meta__row">
              <dt>Version</dt>
              <dd>{version}</dd>
            </div>
            <div className="ghd-settings-meta__row">
              <dt>Created by</dt>
              <dd>{APP_CREATOR}</dd>
            </div>
            <div className="ghd-settings-meta__row">
              <dt>Source</dt>
              <dd>
                <button
                  type="button"
                  className="ghd-settings-link"
                  onClick={() => void openExternalUrl(APP_REPO_URL)}
                >
                  github.com/olususus/smoke
                  <ExternalLink size={12} aria-hidden />
                </button>
              </dd>
            </div>
          </dl>
        </div>

        <footer className="ghd-modal-footer">
          <button
            type="button"
            className="gh-commit-btn"
            style={{ width: "auto", padding: "8px 20px" }}
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
