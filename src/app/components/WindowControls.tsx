"use client";

import React, { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

export function WindowControls() {
  const [tauri, setTauri] = useState(false);

  useEffect(() => {
    setTauri(isTauri());
  }, []);

  if (!tauri) return null;

  const run = async (action: (w: Awaited<ReturnType<typeof import("@tauri-apps/api/window").getCurrentWindow>>) => Promise<void>) => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await action(getCurrentWindow());
    } catch (err) {
      console.error("Window control failed:", err);
    }
  };

  return (
    <div className="window-chrome__controls">
      <button
        type="button"
        className="window-chrome__ctrl"
        aria-label="Minimize"
        onClick={() => void run((w) => w.minimize())}
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        className="window-chrome__ctrl"
        aria-label="Maximize"
        onClick={() => void run((w) => w.toggleMaximize())}
      >
        <Square size={12} />
      </button>
      <button
        type="button"
        className="window-chrome__ctrl window-chrome__ctrl--close"
        aria-label="Close"
        onClick={() => void run((w) => w.close())}
      >
        <X size={14} />
      </button>
    </div>
  );
}
