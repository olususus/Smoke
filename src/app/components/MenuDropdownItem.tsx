"use client";

import React from "react";
import { menuShortcut } from "@/lib/menu-shortcuts";

interface Props {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  href?: string;
}

export function MenuDropdownItem({ label, shortcut, disabled, title, onClick, href }: Props) {
  const shortcutLabel = shortcut ? menuShortcut(shortcut) : null;

  if (href && !disabled) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="gh-dropdown-item gh-dropdown-item--with-shortcut"
        title={title}
        onClick={onClick}
      >
        <span className="gh-dropdown-item__label">{label}</span>
        {shortcutLabel && <span className="gh-dropdown-item__shortcut">{shortcutLabel}</span>}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="gh-dropdown-item gh-dropdown-item--with-shortcut"
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <span className="gh-dropdown-item__label">{label}</span>
      {shortcutLabel && <span className="gh-dropdown-item__shortcut">{shortcutLabel}</span>}
    </button>
  );
}
