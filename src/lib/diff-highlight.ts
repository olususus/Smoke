/** Lightweight keyword spans for diff syntax highlighting. */
export function highlightDiffSegments(
  content: string,
  filePath: string
): { text: string; keyword?: boolean }[] {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (!["ts", "tsx", "js", "jsx", "rs", "py", "go"].includes(ext)) {
    return [{ text: content }];
  }

  const keywords =
    ext === "rs"
      ? /\b(fn|let|mut|pub|use|impl|struct|enum|match|if|else|return|async|await)\b/g
      : /\b(const|let|var|function|return|if|else|import|export|from|class|interface|type|async|await)\b/g;

  const segments: { text: string; keyword?: boolean }[] = [];
  let last = 0;
  for (const m of content.matchAll(keywords)) {
    const idx = m.index ?? 0;
    if (idx > last) segments.push({ text: content.slice(last, idx) });
    segments.push({ text: m[0], keyword: true });
    last = idx + m[0].length;
  }
  if (last < content.length) segments.push({ text: content.slice(last) });
  if (segments.length === 0) segments.push({ text: content });
  return segments;
}
