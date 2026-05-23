"use client";

import { useEffect, useState } from "react";

/** Mount immediately on open; delay unmount until exit animation finishes. */
export function useAnimatedPresence(open: boolean, durationMs: number) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (durationMs === 0) {
        setVisible(true);
        return;
      }
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }

    setVisible(false);
    if (durationMs === 0) {
      setMounted(false);
      return;
    }

    const t = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs]);

  return { mounted, visible };
}
