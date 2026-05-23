"use client";

import React, { useMemo } from "react";
import { useGit, CommitInfo } from "../context/GitContext";
import { GitCommitVertical } from "lucide-react";

const ROW_H = 36;
const NODE_R = 5;
const COL_W = 20;
const GRAPH_W = 120;

export function NeuralGraph() {
  const { commits, selectedCommit, selectCommit } = useGit();

  const layout = useMemo(() => {
    const colMap = new Map<string, number>();
    const activeCols: (string | null)[] = [];

    return commits.map((c, i) => {
      let col = activeCols.indexOf(c.hash);
      if (col === -1) {
        col = activeCols.indexOf(null);
        if (col === -1) { col = activeCols.length; activeCols.push(null); }
      }
      activeCols[col] = null;
      colMap.set(c.hash, col);

      // Reserve columns for parents
      c.parents.forEach((p, pi) => {
        if (!activeCols.includes(p)) {
          if (pi === 0) { activeCols[col] = p; }
          else {
            const freeCol = activeCols.indexOf(null);
            if (freeCol !== -1) activeCols[freeCol] = p;
            else activeCols.push(p);
          }
        }
      });

      return { commit: c, col, y: i * ROW_H + ROW_H / 2, maxCols: activeCols.length };
    });
  }, [commits]);

  const colColors = [
    "var(--neural-1)",
    "var(--neural-2)",
    "var(--neural-3)",
    "var(--neural-4)",
    "var(--neural-5)",
    "var(--neural-6)",
    "var(--neural-5)",
    "var(--neural-6)",
  ];

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "8px 0" }}>
      {commits.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: 13 }}>
          No commits yet
        </div>
      )}
      <div style={{ position: "relative", minHeight: commits.length * ROW_H }}>
        <svg style={{ position: "absolute", top: 0, left: 0, width: GRAPH_W, height: commits.length * ROW_H, pointerEvents: "none" }}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {layout.map((node) =>
            node.commit.parents.map((parentHash, pi) => {
              const parentNode = layout.find(n => n.commit.hash === parentHash);
              if (!parentNode) return null;
              const x1 = 16 + node.col * COL_W;
              const y1 = node.y;
              const x2 = 16 + parentNode.col * COL_W;
              const y2 = parentNode.y;
              const color = colColors[node.col % colColors.length];
              return (
                <path
                  key={`${node.commit.hash}-${pi}`}
                  d={node.col === parentNode.col
                    ? `M${x1},${y1} L${x2},${y2}`
                    : `M${x1},${y1} C${x1},${y1 + ROW_H * 0.5} ${x2},${y2 - ROW_H * 0.5} ${x2},${y2}`}
                  fill="none" stroke={color} strokeWidth={1.5} opacity={0.5}
                />
              );
            })
          )}
        </svg>

        {layout.map((node) => {
          const isSelected = selectedCommit?.hash === node.commit.hash;
          const color = colColors[node.col % colColors.length];
          return (
            <div
              key={node.commit.hash}
              onClick={() => selectCommit(node.commit)}
              style={{
                position: "absolute", top: node.y - ROW_H / 2, left: 0, right: 0, height: ROW_H,
                display: "flex", alignItems: "center", gap: 8, padding: "0 12px", cursor: "pointer",
                background: isSelected ? "var(--neural-row-selected)" : "transparent",
                borderLeft: isSelected ? "2px solid var(--glow-blue-bright)" : "2px solid transparent",
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = "var(--neural-row-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ width: GRAPH_W, flexShrink: 0, position: "relative" }}>
                <div style={{
                  position: "absolute", left: 16 + node.col * COL_W - NODE_R, top: "50%", transform: "translateY(-50%)",
                  width: NODE_R * 2, height: NODE_R * 2, borderRadius: "50%",
                  background: node.commit.is_head ? color : "var(--void-black)",
                  border: `2px solid ${color}`,
                  boxShadow: node.commit.is_head ? `0 0 8px ${color}` : "none",
                }} />
              </div>

              <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                {node.commit.refs.map(r => (
                  <span
                    key={r}
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "var(--neural-ref-bg)",
                      color: "var(--neural-ref-text)",
                      fontWeight: 600,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r}
                  </span>
                ))}
                <span style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {node.commit.summary}
                </span>
              </div>

              <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-jetbrains)", flexShrink: 0 }}>
                {node.commit.short_hash}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
