"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { Download, FolderOpen, Plus, Loader2 } from "lucide-react";

export type HomeRepoActionId = "clone" | "add" | "create";

export const HOME_REPO_ACTIONS: {
  id: HomeRepoActionId;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "clone",
    title: "Clone repository",
    description: "Download a repo from GitHub",
    icon: Download,
  },
  {
    id: "add",
    title: "Add local repository",
    description: "Open a folder already on disk",
    icon: FolderOpen,
  },
  {
    id: "create",
    title: "Create repository",
    description: "New repo on GitHub with templates",
    icon: Plus,
  },
];

export function HomeActionCards({
  onAction,
  loadingId,
  disabled,
}: {
  onAction: (id: HomeRepoActionId) => void;
  loadingId?: HomeRepoActionId | null;
  disabled?: boolean;
}) {
  return (
    <div className="gh-home-actions" role="group" aria-label="Repository actions">
      {HOME_REPO_ACTIONS.map(({ id, title, description, icon: Icon }) => {
        const loading = loadingId === id;
        return (
          <button
            key={id}
            type="button"
            className="gh-home-action-card"
            onClick={() => onAction(id)}
            disabled={disabled || (loadingId != null && loadingId !== id)}
          >
            <span className="gh-home-action-card__icon" aria-hidden>
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} strokeWidth={1.75} />}
            </span>
            <span className="gh-home-action-card__text">
              <span className="gh-home-action-card__title">{title}</span>
              <span className="gh-home-action-card__desc">{description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function HomeActionMenuItems({
  onAction,
  onPick,
}: {
  onAction: (id: HomeRepoActionId) => void;
  onPick?: () => void;
}) {
  return (
    <>
      {HOME_REPO_ACTIONS.map(({ id, title, description, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className="gh-home-menu-item"
          onClick={() => {
            onPick?.();
            onAction(id);
          }}
        >
          <span className="gh-home-menu-item__icon" aria-hidden>
            <Icon size={16} strokeWidth={1.75} />
          </span>
          <span className="gh-home-menu-item__body">
            <span className="gh-home-menu-item__title">{title}</span>
            <span className="gh-home-menu-item__desc">{description}</span>
          </span>
        </button>
      ))}
    </>
  );
}
