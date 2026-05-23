"use client";

import React from "react";
import { useSettings } from "../context/SettingsContext";

interface Props {
  fetching: boolean;
  idleText: string;
  warn?: boolean;
}

/**
 * Overlapping idle + fetching lines — crossfade together, no blank gap or text morph.
 */
export function ToolbarFetchStatus({ fetching, idleText, warn }: Props) {
  const { isMotionInstant } = useSettings();

  return (
    <span
      className={`gh-toolbar-fetch-status${fetching ? " gh-toolbar-fetch-status--busy" : ""}${warn ? " gh-toolbar-fetch-status--warn" : ""}${isMotionInstant ? " gh-toolbar-fetch-status--instant" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={fetching}
    >
      <span className="gh-toolbar-fetch-status__idle">{idleText}</span>
      <span className="gh-toolbar-fetch-status__fetching">Fetching…</span>
    </span>
  );
}
