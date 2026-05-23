import type { DiffResult } from "@/app/context/GitContext";

export interface SecretFinding {
  id: string;
  file: string;
  line: number | null;
  hunkIndex: number;
  lineIndex: number;
  secretType: string | null;
  preview: string;
  section: "working" | "staged" | "commit";
}

function maskPreview(content: string, maxLen = 72): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxLen) return trimmed.replace(/\S/g, "•");
  return `${trimmed.slice(0, maxLen).replace(/\S/g, "•")}…`;
}

function collectFromDiff(
  diff: DiffResult | null | undefined,
  section: SecretFinding["section"]
): SecretFinding[] {
  if (!diff) return [];
  const out: SecretFinding[] = [];

  for (const file of diff.files) {
    file.hunks.forEach((hunk, hi) => {
      hunk.lines.forEach((line, li) => {
        if (!line.is_secret) return;
        out.push({
          id: `${section}:${file.path}:${hi}:${li}`,
          file: file.path,
          line: line.new_lineno ?? line.old_lineno,
          hunkIndex: hi,
          lineIndex: li,
          secretType: line.secret_type,
          preview: maskPreview(line.content),
          section,
        });
      });
    });
  }

  return out;
}

function collectCustomFromDiff(
  diff: DiffResult | null | undefined,
  section: SecretFinding["section"],
  patterns: RegExp[]
): SecretFinding[] {
  if (!diff || patterns.length === 0) return [];
  const out: SecretFinding[] = [];
  for (const file of diff.files) {
    file.hunks.forEach((hunk, hi) => {
      hunk.lines.forEach((line, li) => {
        if (line.is_secret) return;
        const text = line.content;
        for (const pattern of patterns) {
          if (pattern.test(text)) {
            out.push({
              id: `custom:${section}:${file.path}:${hi}:${li}`,
              file: file.path,
              line: line.new_lineno ?? line.old_lineno,
              hunkIndex: hi,
              lineIndex: li,
              secretType: "custom",
              preview: maskPreview(text),
              section,
            });
            break;
          }
        }
      });
    });
  }
  return out;
}

export function collectSecretsFromDiffs(
  working: DiffResult | null | undefined,
  staged: DiffResult | null | undefined,
  commit?: DiffResult | null | undefined,
  customPatternStrings: string[] = []
): SecretFinding[] {
  const customPatterns = customPatternStrings
    .map((p) => {
      try {
        return new RegExp(p);
      } catch {
        return null;
      }
    })
    .filter((p): p is RegExp => p !== null);

  return [
    ...collectFromDiff(staged, "staged"),
    ...collectFromDiff(working, "working"),
    ...collectFromDiff(commit, "commit"),
    ...collectCustomFromDiff(staged, "staged", customPatterns),
    ...collectCustomFromDiff(working, "working", customPatterns),
    ...collectCustomFromDiff(commit, "commit", customPatterns),
  ];
}
