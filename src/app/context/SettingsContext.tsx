"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  motionDurationMs,
  motionDurationSlowMs,
  saveAppSettings,
  type AppSettings,
  type CommitSafetyMode,
  type MotionMode,
  type ThemeMode,
} from "@/lib/app-settings";
import { applyThemeMode } from "@/lib/theme";

interface SettingsContextValue {
  settings: AppSettings;
  motion: MotionMode;
  isMotionInstant: boolean;
  motionDurationMs: number;
  motionDurationSlowMs: number;
  setTheme: (theme: ThemeMode) => void;
  setMotion: (motion: MotionMode) => void;
  setCommitSafety: (mode: CommitSafetyMode) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadAppSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.motion = settings.motion;
    applyThemeMode(settings.theme);
    saveAppSettings(settings);
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated || settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeMode("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.theme, hydrated]);

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((s) => ({ ...s, theme }));
  }, []);

  const setMotion = useCallback((motion: MotionMode) => {
    setSettings((s) => ({ ...s, motion }));
  }, []);

  const setCommitSafety = useCallback((commitSafety: CommitSafetyMode) => {
    setSettings((s) => ({ ...s, commitSafety }));
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      motion: settings.motion,
      isMotionInstant: settings.motion === "instant",
      motionDurationMs: motionDurationMs(settings.motion),
      motionDurationSlowMs: motionDurationSlowMs(settings.motion),
      setTheme,
      setMotion,
      setCommitSafety,
      updateSettings,
    }),
    [settings, setTheme, setMotion, setCommitSafety, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
