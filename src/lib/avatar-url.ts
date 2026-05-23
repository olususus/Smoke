/** Display names that map to a GitHub bot login (not a human username). */
const KNOWN_BOT_LOGINS: Record<string, string> = {
  claude: "claude[bot]",
  copilot: "copilot-swe-agent[bot]",
};

export interface SignedInGitHubProfile {
  login: string;
  name: string;
  avatarUrl: string;
}

export function avatarCacheKey(authorName: string, authorEmail: string): string {
  return `${authorEmail.trim().toLowerCase()}\0${authorName.trim()}`;
}

/**
 * GitHub login derived only from commit email (and explicit bot markers).
 * Never treats git author display name as a GitHub username.
 */
export function githubLoginFromEmail(authorEmail: string, authorName = ""): string | null {
  const email = authorEmail.trim().toLowerCase();
  const name = authorName.trim();

  if (email.endsWith("@users.noreply.github.com")) {
    const local = email.slice(0, -"@users.noreply.github.com".length);
    const plus = local.indexOf("+");
    if (plus > 0) {
      const login = local.slice(plus + 1);
      if (login) return login;
    } else if (local && !/^\d+$/.test(local)) {
      return local;
    }
  }

  const botPart = name.split(/\s+/).find((p) => p.includes("[bot]"));
  if (botPart) return botPart;

  if (email.includes("anthropic")) return "claude[bot]";

  if (email.includes("github-actions")) {
    const m = email.match(/^([^@+]+)/);
    if (m?.[1]) return `${m[1]}[bot]`;
  }

  const known = KNOWN_BOT_LOGINS[name.toLowerCase()];
  if (known) return known;

  return null;
}

/** @deprecated Use githubLoginFromEmail */
export function inferGithubLogin(authorName: string, authorEmail: string): string | null {
  return githubLoginFromEmail(authorEmail, authorName);
}

/**
 * True when this commit author is the signed-in GitHub user.
 * Uses noreply email when present; otherwise login or profile display name only.
 */
export function commitAuthorIsSignedInUser(
  authorName: string,
  authorEmail: string,
  me: SignedInGitHubProfile
): boolean {
  const emailLogin = githubLoginFromEmail(authorEmail, authorName);
  if (emailLogin) {
    return emailLogin.toLowerCase() === me.login.toLowerCase();
  }

  const name = authorName.trim();
  if (!name) return false;
  if (name.toLowerCase() === me.login.toLowerCase()) return true;
  const profileName = me.name.trim();
  if (profileName && name.toLowerCase() === profileName.toLowerCase()) return true;

  return false;
}

export function githubLoginAvatar(login: string): string {
  return `https://avatars.githubusercontent.com/${encodeURIComponent(login.trim())}?s=64&v=4`;
}

/** Ordered avatar URL candidates when the primary URL fails to load. */
export function avatarUrlCandidates(
  authorName: string,
  authorEmail: string,
  primaryUrl?: string | null
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (url: string | undefined | null) => {
    const u = url?.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  const email = authorEmail.trim().toLowerCase();
  const name = authorName.trim();
  const primary = primaryUrl?.trim();
  if (primary) add(primary);

  if (email.endsWith("@users.noreply.github.com")) {
    const local = email.slice(0, -"@users.noreply.github.com".length);
    const plus = local.indexOf("+");
    if (plus > 0) {
      const id = local.slice(0, plus);
      const login = local.slice(plus + 1);
      if (/^\d+$/.test(id)) add(`https://avatars.githubusercontent.com/u/${id}?s=64&v=4`);
      if (login) add(githubLoginAvatar(login));
    } else if (local) {
      add(githubLoginAvatar(local));
    }
  }

  const botLogin = name.split(/\s+/).find((p) => p.includes("[bot]"));
  if (botLogin) add(githubLoginAvatar(botLogin));

  const emailLogin = githubLoginFromEmail(email, name);
  if (emailLogin) add(githubLoginAvatar(emailLogin));

  return out;
}
