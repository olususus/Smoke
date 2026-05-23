import type { DiffHunk } from "@/app/context/GitContext";

/** Build a unified diff patch for a single hunk (for git apply --cached). */
export function buildHunkPatch(filePath: string, hunk: DiffHunk): string {
  const lines: string[] = [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    hunk.header.startsWith("@@") ? hunk.header : `@@ ${hunk.header} @@`,
  ];

  for (const line of hunk.lines) {
    if (line.origin === "+") {
      lines.push(`+${line.content}`);
    } else if (line.origin === "-") {
      lines.push(`-${line.content}`);
    } else {
      lines.push(` ${line.content}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
