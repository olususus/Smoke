"use client";

import { useEffect, useRef } from "react";
import { useGit } from "../context/GitContext";
import { useSettings } from "../context/SettingsContext";

const VISIBLE_MS = 4000;
const HIDDEN_MS = 15000;

export function useRepoAutoRefresh(options: {
  enabled: boolean;
  busy?: boolean;
  onExternalChange?: () => void;
}) {
  const { repoPath, refreshBackground, pauseBackgroundRefresh, resumeBackgroundRefresh } =
    useGit();
  const { settings } = useSettings();
  const busyRef = useRef(options.busy ?? false);
  const onChangeRef = useRef(options.onExternalChange);

  busyRef.current = options.busy ?? false;
  onChangeRef.current = options.onExternalChange;

  useEffect(() => {
    if (!options.enabled || !repoPath || !settings.backgroundRefresh) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), delayMs);
    };

    const tick = async () => {
      if (cancelled || busyRef.current) {
        schedule(document.visibilityState === "visible" ? VISIBLE_MS : HIDDEN_MS);
        return;
      }
      pauseBackgroundRefresh();
      try {
        const changed = await refreshBackground();
        if (changed) onChangeRef.current?.();
      } finally {
        resumeBackgroundRefresh();
      }
      if (cancelled) return;
      const interval =
        document.visibilityState === "visible" ? VISIBLE_MS : HIDDEN_MS;
      schedule(interval);
    };

    const onVisibility = () => {
      schedule(document.visibilityState === "visible" ? 500 : HIDDEN_MS);
    };

    document.addEventListener("visibilitychange", onVisibility);
    schedule(800);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [
    options.enabled,
    repoPath,
    settings.backgroundRefresh,
    refreshBackground,
    pauseBackgroundRefresh,
    resumeBackgroundRefresh,
  ]);
}
