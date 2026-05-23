"use client";

import React from "react";
import { Plus, X } from "lucide-react";
import type { CoAuthor } from "@/lib/build-commit-message";

interface Props {
  authors: CoAuthor[];
  onChange: (authors: CoAuthor[]) => void;
}

export function CoAuthorFields({ authors, onChange }: Props) {
  const add = () => onChange([...authors, { name: "", email: "" }]);

  const update = (index: number, field: keyof CoAuthor, value: string) => {
    const next = authors.map((a, i) => (i === index ? { ...a, [field]: value } : a));
    onChange(next);
  };

  const remove = (index: number) => onChange(authors.filter((_, i) => i !== index));

  return (
    <div className="co-author-fields">
      <div className="co-author-fields__header">
        <span className="co-author-fields__label">Co-authors</span>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={add}>
          <Plus size={12} /> Add
        </button>
      </div>
      {authors.map((a, i) => (
        <div key={i} className="co-author-fields__row">
          <input
            className="ghd-filter-input"
            placeholder="Name"
            value={a.name}
            onChange={(e) => update(i, "name", e.target.value)}
            style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
          />
          <input
            className="ghd-filter-input"
            placeholder="email@example.com"
            value={a.email}
            onChange={(e) => update(i, "email", e.target.value)}
            style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
          />
          <button type="button" className="ghd-icon-btn" onClick={() => remove(i)} aria-label="Remove co-author">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
