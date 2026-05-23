"use client";

import { Bug } from "lucide-react";
import { APP_ISSUES_URL } from "@/lib/app-meta";
import { openExternalUrl } from "@/lib/open-external";

interface Props {
  variant?: "strip" | "inline";
  className?: string;
}

export function BetaBanner({ variant = "strip", className = "" }: Props) {
  const rootClass = [
    "ghd-beta-banner",
    `ghd-beta-banner--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="status">
      <span className="ghd-beta-banner__badge">Beta</span>
      <p className="ghd-beta-banner__text">
        Smoke is in early beta. Expect rough edges and report anything broken.
      </p>
      <button
        type="button"
        className="ghd-beta-banner__link"
        onClick={() => void openExternalUrl(APP_ISSUES_URL)}
      >
        <Bug size={14} aria-hidden />
        Report a bug on GitHub
      </button>
    </div>
  );
}
