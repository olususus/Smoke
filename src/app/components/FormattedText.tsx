"use client";

import React, { useState, useEffect } from "react";
import { Loader2, MessageSquare, GitPullRequest, User } from "lucide-react";
import { githubApiFetch } from "@/lib/github-api";

interface FormattedTextProps {
  text: string;
  repoOwner?: string | null;
  repoName?: string | null;
}

export function FormattedText({ text, repoOwner, repoName }: FormattedTextProps) {
  const regex = /(#\d+|@[a-zA-Z0-9\-]+)/g;
  const parts = text.split(regex);

  return (
    <span style={{ wordBreak: "break-word" }}>
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          const num = part.substring(1);
          return (
            <IssueLink key={i} num={num} text={part} repoOwner={repoOwner} repoName={repoName} />
          );
        }
        if (part.startsWith("@")) {
          const username = part.substring(1);
          return <UserLink key={i} username={username} text={part} />;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}

function IssueLink({
  num,
  text,
  repoOwner,
  repoName,
}: {
  num: string;
  text: string;
  repoOwner?: string | null;
  repoName?: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const [data, setData] = useState<{
    title?: string;
    state?: string;
    user?: { login?: string };
    pull_request?: unknown;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hovered || data || loading) return;
    if (!repoOwner || !repoName) return;
    setLoading(true);

    void githubApiFetch<{
      title?: string;
      state?: string;
      user?: { login?: string };
      pull_request?: unknown;
    }>(`/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/issues/${num}`)
      .then((json) => {
        if (json?.title) setData(json);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hovered, num, data, loading, repoOwner, repoName]);

  const stateColor = data?.state === "open" ? "#10B981" : "#8B5CF6";

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        color: "var(--glow-blue-bright)",
        cursor: repoOwner && repoName ? "pointer" : "default",
        textDecoration: repoOwner && repoName ? "underline" : "none",
      }}
    >
      {text}
      {hovered && repoOwner && repoName && (
        <div style={styles.popover}>
          {loading ? (
            <div style={styles.popoverLoading}>
              <Loader2 size={14} className="animate-spin" /> Loading issue…
            </div>
          ) : data ? (
            <div style={styles.popoverContent}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                {data.pull_request ? (
                  <GitPullRequest size={14} style={{ color: stateColor }} />
                ) : (
                  <MessageSquare size={14} style={{ color: stateColor }} />
                )}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: stateColor,
                  }}
                >
                  {data.state}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>#{num}</span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 4,
                }}
              >
                {data.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                by <span style={{ color: "var(--text-primary)" }}>{data.user?.login}</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </span>
  );
}

function UserLink({ username, text }: { username: string; text: string }) {
  const [hovered, setHovered] = useState(false);
  const [data, setData] = useState<{
    login?: string;
    name?: string;
    bio?: string;
    avatar_url?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hovered || data || loading) return;
    setLoading(true);

    void githubApiFetch<{
      login?: string;
      name?: string;
      bio?: string;
      avatar_url?: string;
    }>(`/users/${encodeURIComponent(username)}`)
      .then((json) => {
        if (json?.login) setData(json);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hovered, username, data, loading]);

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", color: "#F59E0B", cursor: "pointer", fontWeight: 500 }}
    >
      {text}
      {hovered && (
        <div style={{ ...styles.popover, width: 220 }}>
          {loading ? (
            <div style={styles.popoverLoading}>
              <Loader2 size={14} className="animate-spin" /> Loading profile…
            </div>
          ) : data ? (
            <div style={{ ...styles.popoverContent, display: "flex", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.avatar_url}
                alt={data.login}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "1px solid var(--void-border)",
                }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {data.name || data.login}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>@{data.login}</div>
                {data.bio && (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                    {data.bio}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  popover: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    marginBottom: 8,
    width: 280,
    background: "var(--gh-panel)",
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    zIndex: 100,
    padding: 10,
    pointerEvents: "none",
  },
  popoverLoading: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    color: "var(--text-secondary)",
  },
  popoverContent: {
    fontSize: 12,
  },
};
