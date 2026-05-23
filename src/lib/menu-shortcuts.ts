/** Display accelerator for menus (Linux/Windows use Ctrl). */
export function menuShortcut(keys: string): string {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  if (!isMac) return keys;
  return keys
    .replace(/Ctrl\+/g, "⌘")
    .replace(/Alt\+/g, "⌥")
    .replace(/Shift\+/g, "⇧");
}

export type RepoMenuAction =
  | "newBranch"
  | "renameBranch"
  | "deleteBranch"
  | "discardAll"
  | "stashAll"
  | "updateFromMain"
  | "compareBranch"
  | "mergeIntoCurrent"
  | "compareOnGitHub"
  | "viewBranchOnGitHub"
  | "createPullRequest"
  | "fetch"
  | "pull"
  | "push"
  | "squashMerge"
  | "rebase"
  | "previewPr";

/** Match GitHub Desktop–style repo shortcuts (Ctrl+Shift+…). */
export function matchRepoShortcut(e: KeyboardEvent): RepoMenuAction | null {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return null;

  if (e.shiftKey && (e.key === "N" || e.key === "n")) return "newBranch";
  if (e.shiftKey && (e.key === "R" || e.key === "r")) return "renameBranch";
  if (e.shiftKey && (e.key === "D" || e.key === "d")) return "deleteBranch";
  if (e.shiftKey && e.key === "Backspace") return "discardAll";
  if (e.shiftKey && (e.key === "S" || e.key === "s")) return "stashAll";
  if (e.shiftKey && (e.key === "U" || e.key === "u")) return "updateFromMain";
  if (e.shiftKey && (e.key === "B" || e.key === "b")) return "compareBranch";
  if (e.shiftKey && (e.key === "M" || e.key === "m")) return "mergeIntoCurrent";
  if (e.shiftKey && (e.key === "C" || e.key === "c")) return "compareOnGitHub";
  if (e.shiftKey && (e.key === "H" || e.key === "h")) return "squashMerge";
  if (e.shiftKey && (e.key === "E" || e.key === "e")) return "rebase";
  if (e.shiftKey && (e.key === "P" || e.key === "p")) return "push";
  if (e.shiftKey && (e.key === "L" || e.key === "l")) return "pull";
  if (e.shiftKey && (e.key === "T" || e.key === "t")) return "fetch";
  if (e.altKey && e.shiftKey && (e.key === "B" || e.key === "b")) return "viewBranchOnGitHub";
  if (e.altKey && !e.shiftKey && (e.key === "p" || e.key === "P")) return "previewPr";
  if (!e.shiftKey && (e.key === "r" || e.key === "R")) return "createPullRequest";

  return null;
}
