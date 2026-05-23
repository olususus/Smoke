"use client";

import React, { useEffect, useMemo, useState } from "react";
import { avatarUrlCandidates } from "@/lib/avatar-url";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] ?? "?").toUpperCase();
}

export function AuthorAvatar({
  name,
  email = "",
  avatarUrl,
  size = 28,
}: {
  name: string;
  email?: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const candidates = useMemo(() => {
    const list = avatarUrlCandidates(name, email, avatarUrl);
    return list.length > 0 ? list : [];
  }, [name, email, avatarUrl]);

  const [index, setIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setIndex(0);
    setExhausted(false);
  }, [candidates]);

  const url = !exhausted && index < candidates.length ? candidates[index] : null;

  const tryNext = () => {
    setIndex((i) => {
      const next = i + 1;
      if (next < candidates.length) return next;
      setExhausted(true);
      return i;
    });
  };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${url}-${index}`}
        src={url}
        alt=""
        width={size}
        height={size}
        className="commit-row-avatar-img"
        referrerPolicy="no-referrer"
        decoding="async"
        onError={tryNext}
      />
    );
  }

  return (
    <div className="commit-row-avatar" aria-hidden style={{ width: size, height: size }}>
      {initials(name)}
    </div>
  );
}
