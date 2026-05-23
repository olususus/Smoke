"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink, Settings, X } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import type { CommitSafetyMode } from "@/lib/app-settings";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { openExternalUrl } from "@/lib/open-external";
import { ProfileSwitcher } from "./ProfileSwitcher";
import {
  APP_CREATOR,
  APP_REPO_URL,
  APP_VERSION_FALLBACK,
  getAppVersion,
} from "@/lib/app-meta";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AppSettingsDialog({ open, onClose }: Props) {
  const { settings, setTheme, setMotion, setCommitSafety, updateSettings, motionDurationMs } =
    useSettings();
  const [customPatternsText, setCustomPatternsText] = useState("");
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);
  const [version, setVersion] = useState(APP_VERSION_FALLBACK);

  useEffect(() => {
    if (!open) return;
    void getAppVersion().then(setVersion);
    setCustomPatternsText(settings.customSecretPatterns.join("\n"));
  }, [open, settings.customSecretPatterns]);

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
        className={`ghd-modal ghd-settings-modal${visible ? " ghd-settings-modal--visible" : ""}`}
        role="dialog"
        aria-labelledby="app-settings-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ghd-modal-header">
          <div className="ghd-settings-modal__title">
            <Settings size={16} className="ghd-settings-modal__icon" aria-hidden />
            <h2 id="app-settings-title">App settings</h2>
          </div>
          <button type="button" className="ghd-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="ghd-settings-modal__body">
          <section className="ghd-settings-group">
            <h3 className="ghd-settings-group__title">Appearance</h3>
            <p className="ghd-settings-group__desc">
              Dark and light themes, or match your system setting.
            </p>
            <div className="ghd-settings-options" role="radiogroup" aria-label="Appearance">
              {(
                [
                  ["dark", "Dark", "Frutiger aero on black (default)"],
                  ["light", "Light", "Bright panels and readable diffs"],
                  ["system", "System", "Follow OS light / dark mode"],
                ] as const
              ).map(([value, title, desc]) => (
                <label
                  key={value}
                  className={`ghd-settings-option${settings.theme === value ? " ghd-settings-option--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={settings.theme === value}
                    onChange={() => setTheme(value)}
                  />
                  <span className="ghd-settings-option__title">{title}</span>
                  <span className="ghd-settings-option__desc">{desc}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="ghd-settings-group">
            <h3 className="ghd-settings-group__title">Interface motion</h3>
            <p className="ghd-settings-group__desc">
              Smooth transitions for tabs, menus, and dialogs. Instant mode skips animations.
            </p>
            <div className="ghd-settings-options" role="radiogroup" aria-label="Interface motion">
              <label
                className={`ghd-settings-option${settings.motion === "smooth" ? " ghd-settings-option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="motion"
                  value="smooth"
                  checked={settings.motion === "smooth"}
                  onChange={() => setMotion("smooth")}
                />
                <span className="ghd-settings-option__title">Smooth (default)</span>
                <span className="ghd-settings-option__desc">
                  Gentle fades and slides
                </span>
              </label>
              <label
                className={`ghd-settings-option${settings.motion === "instant" ? " ghd-settings-option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="motion"
                  value="instant"
                  checked={settings.motion === "instant"}
                  onChange={() => setMotion("instant")}
                />
                <span className="ghd-settings-option__title">Instant</span>
                <span className="ghd-settings-option__desc">No transition delays</span>
              </label>
            </div>
          </section>

          <section className="ghd-settings-group">
            <h3 className="ghd-settings-group__title">Repository sync</h3>
            <p className="ghd-settings-group__desc">
              Detect changes from the terminal or other tools while this repo is open (every few
              seconds when the window is focused).
            </p>
            <label className="ghd-check-row">
              <input
                type="checkbox"
                checked={settings.backgroundRefresh}
                onChange={(e) => updateSettings({ backgroundRefresh: e.target.checked })}
              />
              Background refresh
            </label>
          </section>

          <section className="ghd-settings-group">
            <h3 className="ghd-settings-group__title">Commit safety gate</h3>
            <p className="ghd-settings-group__desc">
              Scan staged changes for API keys, tokens, and passwords before you commit.
            </p>
            <div className="ghd-settings-options" role="radiogroup" aria-label="Commit safety gate">
              {(
                [
                  ["block", "Block commit", "Prevent commits until secrets are removed"],
                  ["warn", "Warn", "Confirm before committing with secrets present"],
                  ["off", "Off", "Scan in diffs only — no commit-time checks"],
                ] as const
              ).map(([value, title, desc]) => (
                <label
                  key={value}
                  className={`ghd-settings-option${settings.commitSafety === value ? " ghd-settings-option--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="commitSafety"
                    value={value}
                    checked={settings.commitSafety === value}
                    onChange={() => setCommitSafety(value as CommitSafetyMode)}
                  />
                  <span className="ghd-settings-option__title">{title}</span>
                  <span className="ghd-settings-option__desc">{desc}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="ghd-settings-group">
            <h3 className="ghd-settings-group__title">Custom secret patterns</h3>
            <p className="ghd-settings-group__desc">
              One regex per line. Matched lines are flagged like built-in secret rules.
            </p>
            <textarea
              className="ghd-filter-input"
              style={{ width: "100%", minHeight: 72, fontFamily: "var(--font-jetbrains)", fontSize: 12 }}
              value={customPatternsText}
              onChange={(e) => setCustomPatternsText(e.target.value)}
              onBlur={() =>
                updateSettings({
                  customSecretPatterns: customPatternsText
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean),
                })
              }
              placeholder="my-secret-[A-Za-z0-9]+"
            />
          </section>

          <section className="ghd-settings-group">
            <h3 className="ghd-settings-group__title">Git identity profiles</h3>
            <ProfileSwitcher />
          </section>

          <section className="ghd-settings-group">
            <h3 className="ghd-settings-group__title">External editor</h3>
            <p className="ghd-settings-group__desc">
              Command to open the repo folder in your editor (e.g. code, codium).
            </p>
            <input
              className="ghd-filter-input"
              style={{ width: "100%" }}
              value={settings.externalEditor}
              onChange={(e) => updateSettings({ externalEditor: e.target.value })}
              placeholder="code"
            />
          </section>

          <section className="ghd-settings-group ghd-settings-group--about">
            <h3 className="ghd-settings-group__title">About</h3>
            <dl className="ghd-settings-meta">
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
          </section>
        </div>

        <footer className="ghd-modal-footer">
          <button
            type="button"
            className="gh-commit-btn"
            style={{ width: "auto", padding: "8px 20px" }}
            onClick={onClose}
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
