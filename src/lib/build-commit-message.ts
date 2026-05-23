export interface CoAuthor {
  name: string;
  email: string;
}

/** Build full git commit message with optional Co-authored-by trailers. */
export function buildCommitMessage(summaryAndBody: string, coAuthors: CoAuthor[]): string {
  const base = summaryAndBody.trim();
  if (coAuthors.length === 0) return base;

  const trailers = coAuthors
    .filter((a) => a.name.trim() && a.email.trim())
    .map((a) => `Co-authored-by: ${a.name.trim()} <${a.email.trim()}>`)
    .join("\n");

  if (!trailers) return base;
  return `${base}\n\n${trailers}`;
}
