"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "../context/SettingsContext";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  minWidth?: number;
  /** Align menu to the anchor's trailing edge (use for buttons on the right). */
  align?: "start" | "end";
}

export function DropdownPortal({
  open,
  onClose,
  anchorRef,
  children,
  minWidth = 260,
  align = "start",
}: Props) {
  const { motionDurationMs } = useSettings();
  const { mounted, visible } = useAnimatedPresence(open, motionDurationMs);
  const [pos, setPos] = useState({ top: 0, left: 0, width: minWidth });

  useEffect(() => {
    if (!mounted || !anchorRef.current) return;

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.max(r.width, minWidth);
      const left =
        align === "end"
          ? Math.max(8, r.right - width)
          : Math.min(r.left, window.innerWidth - width - 8);
      setPos({
        top: r.bottom + 6,
        left,
        width,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [mounted, anchorRef, minWidth, align]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className={`gh-dropdown-backdrop${visible ? " gh-dropdown-backdrop--visible" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className={`gh-dropdown gh-dropdown--portal${visible ? " gh-dropdown--visible" : ""}`}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          minWidth: pos.width,
          zIndex: 5000,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
