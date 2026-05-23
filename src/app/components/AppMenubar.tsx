"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropdownPortal } from "./DropdownPortal";
import { AppSettingsDialog } from "./AppSettingsDialog";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { AboutDialog } from "./AboutDialog";
import { MenuDropdownItem } from "./MenuDropdownItem";
import { WindowControls } from "./WindowControls";
import { useRepoMenuShortcuts } from "../hooks/useRepoMenuShortcuts";
import { openExternalUrl } from "@/lib/open-external";
import { githubIssuesUrl } from "@/lib/github-url";

export interface AppMenubarActions {
  onGoHome?: () => void;
  onAddLocalRepo?: () => void;
  onChooseRepository?: () => void;
  onCloneRepository?: () => void;
  onCreateRepository?: () => void;
  onPublishRepository?: () => void;
  onRepositorySettings?: () => void;
  onOpenInTerminal?: () => void;
  onOpenInEditor?: () => void;
  onManageTags?: () => void;
  onSignOut?: () => void;
  onViewOnGitHub?: () => void;
  onNewBranch?: () => void;
  onRenameBranch?: () => void;
  onDeleteBranch?: () => void;
  onPull?: () => void;
  onPush?: () => void;
  onPublishBranch?: () => void;
  publishBranchDisabled?: boolean;
  branchUnpublished?: boolean;
  onFetch?: () => void;
  onDiscardAll?: () => void;
  onStashChanges?: () => void;
  onStashPop?: () => void;
  onStashApply?: () => void;
  onShowStashed?: () => void;
  onUpdateFromMain?: () => void;
  onCompareBranch?: () => void;
  onMergeIntoCurrent?: () => void;
  onSquashMerge?: () => void;
  onRebase?: () => void;
  onPreviewPullRequest?: () => void;
  onCompareOnGitHub?: () => void;
  onViewBranchOnGitHub?: () => void;
  onCreatePullRequest?: () => void;
  onReportIssue?: () => void;
  onShowUserGuides?: () => void;
  onShowLogs?: () => void;
  hasLocalChanges?: boolean;
  stashPopDisabled?: boolean;
  viewOnGitHubDisabled?: boolean;
  githubActionsDisabled?: boolean;
}

interface Props {
  variant: "home" | "repo" | "minimal";
  actions?: AppMenubarActions;
}

export function AppMenubar({ variant, actions }: Props) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLElement | null>(null);

  useRepoMenuShortcuts(variant === "repo", actions);

  const closeMenu = () => setActiveMenu(null);

  const goHome = () => {
    closeMenu();
    if (actions?.onGoHome) {
      actions.onGoHome();
      return;
    }
    router.push("/dashboard");
  };

  const openMenu = (menu: string, el: HTMLElement) => {
    menuAnchorRef.current = el;
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  const menus =
    variant === "minimal"
      ? []
      : variant === "home"
        ? ["File", "View", "Help"]
        : ["File", "Repository", "Branch", "View", "Help"];

  const dirty = actions?.hasLocalChanges ?? false;

  const reportIssue = () => {
    if (actions?.onReportIssue) actions.onReportIssue();
    else void openExternalUrl(githubIssuesUrl());
  };

  const showUserGuides = () => {
    if (actions?.onShowUserGuides) actions.onShowUserGuides();
    else void openExternalUrl("https://docs.github.com/en/desktop");
  };

  const showLogs = () => {
    if (actions?.onShowLogs) {
      actions.onShowLogs();
      return;
    }
    void (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const dir = await invoke<string>("get_log_dir");
        await invoke("open_repo_folder", { repoPath: dir });
      } catch {
        alert("Logs folder is available when running the Smoke desktop app.");
      }
    })();
  };

  return (
    <header className="window-chrome">
      <div className="window-chrome__menus">
        {menus.map((menu) => (
          <button
            key={menu}
            type="button"
            className={`gh-menu-btn${activeMenu === menu ? " gh-menu-btn--active" : ""}`}
            onClick={(e) => openMenu(menu, e.currentTarget)}
          >
            {menu}
          </button>
        ))}
      </div>

      <div className="window-chrome__spacer" data-tauri-drag-region aria-hidden />

      <WindowControls />

      <DropdownPortal open={activeMenu !== null} onClose={closeMenu} anchorRef={menuAnchorRef}>
        {activeMenu === "File" && variant === "home" && (
          <>
            <div className="gh-dropdown-header">Repository</div>
            <MenuDropdownItem
              label="Clone repository…"
              onClick={() => {
                actions?.onCloneRepository?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Create new repository…"
              onClick={() => {
                actions?.onCreateRepository?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Add existing repository…"
              onClick={() => {
                actions?.onAddLocalRepo?.();
                closeMenu();
              }}
            />
            {actions?.onSignOut && (
              <>
                <div className="gh-dropdown-divider" />
                <MenuDropdownItem
                  label="Sign out"
                  onClick={() => {
                    actions.onSignOut?.();
                    closeMenu();
                  }}
                />
              </>
            )}
          </>
        )}
        {activeMenu === "File" && variant === "repo" && (
          <>
            <MenuDropdownItem label="Back to repository list…" onClick={goHome} />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="Add local repository…"
              onClick={() => {
                actions?.onAddLocalRepo?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Choose repository…"
              onClick={() => {
                actions?.onChooseRepository?.();
                closeMenu();
              }}
            />
            {actions?.onPublishRepository && (
              <MenuDropdownItem
                label="Publish repository…"
                onClick={() => {
                  actions.onPublishRepository?.();
                  closeMenu();
                }}
              />
            )}
            <MenuDropdownItem
              label="Repository settings…"
              onClick={() => {
                actions?.onRepositorySettings?.();
                closeMenu();
              }}
            />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="Open in terminal"
              onClick={() => {
                actions?.onOpenInTerminal?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Open in external editor"
              onClick={() => {
                actions?.onOpenInEditor?.();
                closeMenu();
              }}
            />
            {actions?.onSignOut && (
              <>
                <div className="gh-dropdown-divider" />
                <MenuDropdownItem
                  label="Sign out"
                  onClick={() => {
                    actions.onSignOut?.();
                    closeMenu();
                  }}
                />
              </>
            )}
          </>
        )}
        {activeMenu === "Repository" && variant === "repo" && (
          <>
            <MenuDropdownItem label="Back to repository list…" onClick={goHome} />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="Pull"
              onClick={() => {
                actions?.onPull?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label={actions?.branchUnpublished ? "Publish branch…" : "Push"}
              shortcut="Ctrl+Shift+P"
              disabled={actions?.publishBranchDisabled}
              onClick={() => {
                actions?.onPush?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Fetch"
              onClick={() => {
                actions?.onFetch?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Discard all changes…"
              disabled={!dirty}
              title={dirty ? undefined : "No local changes to discard"}
              onClick={() => {
                actions?.onDiscardAll?.();
                closeMenu();
              }}
            />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="Stash all changes…"
              shortcut="Ctrl+Shift+S"
              disabled={!dirty}
              title={dirty ? undefined : "No local changes to stash"}
              onClick={() => {
                actions?.onStashChanges?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Pop latest stash"
              disabled={actions?.stashPopDisabled}
              onClick={() => {
                actions?.onStashPop?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Apply latest stash"
              disabled={actions?.stashPopDisabled}
              onClick={() => {
                actions?.onStashApply?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="View stashed changes…"
              disabled={actions?.stashPopDisabled}
              onClick={() => {
                actions?.onShowStashed?.();
                closeMenu();
              }}
            />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="View on GitHub"
              disabled={actions?.viewOnGitHubDisabled}
              onClick={() => {
                actions?.onViewOnGitHub?.();
                closeMenu();
              }}
            />
          </>
        )}
        {activeMenu === "Branch" && variant === "repo" && (
          <>
            {actions?.onPublishBranch && actions.branchUnpublished && (
              <MenuDropdownItem
                label="Publish branch…"
                disabled={actions.publishBranchDisabled}
                onClick={() => {
                  actions.onPublishBranch?.();
                  closeMenu();
                }}
              />
            )}
            <MenuDropdownItem
              label="New branch…"
              shortcut="Ctrl+Shift+N"
              onClick={() => {
                actions?.onNewBranch?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Rename…"
              shortcut="Ctrl+Shift+R"
              onClick={() => {
                actions?.onRenameBranch?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Delete…"
              shortcut="Ctrl+Shift+D"
              onClick={() => {
                actions?.onDeleteBranch?.();
                closeMenu();
              }}
            />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="Manage tags…"
              onClick={() => {
                actions?.onManageTags?.();
                closeMenu();
              }}
            />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="Discard all changes…"
              shortcut="Ctrl+Shift+Backspace"
              disabled={!dirty}
              onClick={() => {
                actions?.onDiscardAll?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Stash all changes"
              shortcut="Ctrl+Shift+S"
              disabled={!dirty}
              onClick={() => {
                actions?.onStashChanges?.();
                closeMenu();
              }}
            />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="Update from main"
              shortcut="Ctrl+Shift+U"
              onClick={() => {
                actions?.onUpdateFromMain?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Compare to branch"
              shortcut="Ctrl+Shift+B"
              onClick={() => {
                actions?.onCompareBranch?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Merge into current branch…"
              shortcut="Ctrl+Shift+M"
              onClick={() => {
                actions?.onMergeIntoCurrent?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Squash and merge into current branch…"
              shortcut="Ctrl+Shift+H"
              onClick={() => {
                actions?.onSquashMerge?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Rebase current branch…"
              shortcut="Ctrl+Shift+E"
              onClick={() => {
                actions?.onRebase?.();
                closeMenu();
              }}
            />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="Compare on GitHub"
              shortcut="Ctrl+Shift+C"
              disabled={actions?.githubActionsDisabled}
              onClick={() => {
                actions?.onCompareOnGitHub?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="View branch on GitHub"
              shortcut="Alt+Ctrl+B"
              disabled={actions?.githubActionsDisabled}
              onClick={() => {
                actions?.onViewBranchOnGitHub?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Preview pull request"
              shortcut="Alt+Ctrl+P"
              disabled={actions?.githubActionsDisabled}
              title="Open pull requests in Smoke"
              onClick={() => {
                actions?.onPreviewPullRequest?.();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Create pull request"
              shortcut="Ctrl+R"
              disabled={actions?.githubActionsDisabled}
              onClick={() => {
                actions?.onCreatePullRequest?.();
                closeMenu();
              }}
            />
          </>
        )}
        {activeMenu === "View" && (
          <MenuDropdownItem
            label="App settings…"
            onClick={() => {
              setSettingsOpen(true);
              closeMenu();
            }}
          />
        )}
        {activeMenu === "Help" && (
          <>
            <MenuDropdownItem
              label="Report issue…"
              onClick={() => {
                reportIssue();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Show User Guides"
              onClick={() => {
                showUserGuides();
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Show keyboard shortcuts"
              onClick={() => {
                setShortcutsOpen(true);
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="Show logs in your File Manager"
              onClick={() => {
                showLogs();
                closeMenu();
              }}
            />
            <div className="gh-dropdown-divider" />
            <MenuDropdownItem
              label="About Smoke"
              onClick={() => {
                setAboutOpen(true);
                closeMenu();
              }}
            />
            <MenuDropdownItem
              label="App settings…"
              onClick={() => {
                setSettingsOpen(true);
                closeMenu();
              }}
            />
          </>
        )}
      </DropdownPortal>

      <AppSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </header>
  );
}
