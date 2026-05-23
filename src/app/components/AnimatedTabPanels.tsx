"use client";

import React from "react";

interface Panel<T extends string> {
  id: T;
  content: React.ReactNode;
}

interface Props<T extends string> {
  active: T;
  panels: Panel<T>[];
  className?: string;
}

/** Cross-fade tab panels (Changes / History, sidebar + workspace). */
export function AnimatedTabPanels<T extends string>({
  active,
  panels,
  className = "",
}: Props<T>) {
  return (
    <div className={`gh-tab-panels ${className}`.trim()}>
      {panels.map((panel) => (
        <div
          key={panel.id}
          className={`gh-tab-panel${active === panel.id ? " gh-tab-panel--active" : ""}`}
          aria-hidden={active !== panel.id}
        >
          {panel.content}
        </div>
      ))}
    </div>
  );
}
