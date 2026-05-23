"use client";

import { useEffect, useState } from "react";
import type { CommitInfo } from "../context/GitContext";
import {
  avatarCacheKey,
  commitAuthorIsSignedInUser,
  githubLoginFromEmail,
  type SignedInGitHubProfile,
} from "@/lib/avatar-url";
import { getStoredAuth } from "@/lib/auth";
import { githubApiFetch } from "@/lib/github-api";

const loginAvatarCache = new Map<string, string>();

async function fetchSignedInProfile(): Promise<SignedInGitHubProfile | null> {
  const stored = await getStoredAuth();
  if (!stored?.has_token) return null;

  if (stored.username && stored.avatar_url) {
    return {
      login: stored.username,
      name: stored.name?.trim() || stored.username,
      avatarUrl: stored.avatar_url,
    };
  }

  try {
    const data = await githubApiFetch<{
      login?: string;
      name?: string | null;
      avatar_url?: string;
    }>("/user");
    const login = data.login?.trim();
    const avatarUrl = data.avatar_url?.trim();
    if (!login || !avatarUrl) return null;
    return {
      login,
      name: (data.name ?? "").trim() || login,
      avatarUrl,
    };
  } catch {
    return null;
  }
}

export function useCommitAvatarOverrides(commits: CommitInfo[]): Map<string, string> {
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (commits.length === 0) return;

      const me = await fetchSignedInProfile();
      if (cancelled) return;

      const loginByKey = new Map<string, string>();
      const directByKey = new Map<string, string>();

      for (const c of commits) {
        const key = avatarCacheKey(c.author_name, c.author_email);

        if (me && commitAuthorIsSignedInUser(c.author_name, c.author_email, me)) {
          directByKey.set(key, me.avatarUrl);
          continue;
        }

        const login = githubLoginFromEmail(c.author_email, c.author_name);
        if (login) loginByKey.set(key, login);
      }

      const uniqueLogins = [...new Set(loginByKey.values())];
      const pending = uniqueLogins.filter((login) => !loginAvatarCache.has(login));

      if (pending.length > 0) {
        await Promise.all(
          pending.map(async (login) => {
            try {
              const data = await githubApiFetch<{ avatar_url?: string }>(
                `/users/${encodeURIComponent(login)}`
              );
              const url = data.avatar_url?.trim();
              if (url) loginAvatarCache.set(login, url);
            } catch {
              /* offline or rate limited */
            }
          })
        );
      }

      if (cancelled) return;

      const next = new Map<string, string>(directByKey);
      for (const [key, login] of loginByKey) {
        const url = loginAvatarCache.get(login);
        if (url) next.set(key, url);
      }
      if (next.size > 0) setOverrides(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [commits]);

  return overrides;
}
