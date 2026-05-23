"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Check, Settings } from "lucide-react";
import { useGit } from "../context/GitContext";
import { confirmApp } from "@/lib/app-dialog";

export interface Profile {
  id: string;
  name: string;
  git_username: string;
  git_email: string;
  ssh_key_path?: string;
}

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return await invoke<T>(cmd, args);
}

/** Git author identity presets (name, email, optional SSH key). Managed in App settings. */
export function ProfileSwitcher() {
  const { repoPath } = useGit();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<Partial<Profile> | null>(null);

  const loadData = async () => {
    try {
      const list = await invokeTauri<Profile[]>("get_profiles");
      setProfiles(list);
      const active = await invokeTauri<string | null>("get_active_profile_id");
      setActiveId(active);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSwitch = async (id: string | null) => {
    try {
      if (id === null) {
        await invokeTauri("clear_active_profile", { repoPath: repoPath || null });
        setActiveId(null);
      } else {
        await invokeTauri("switch_profile", { repoPath: repoPath || null, id });
        setActiveId(id);
      }
      if (repoPath) {
        window.location.reload();
      }
    } catch (e) {
      alert("Failed to switch profile: " + e);
    }
  };

  const handleSave = async () => {
    if (!editProfile?.name || !editProfile?.git_username || !editProfile?.git_email) {
      alert("Please fill in Profile Name, Git Username, and Git Email.");
      return;
    }
    const profileToSave: Profile = {
      id: editProfile.id || "prof_" + Date.now(),
      name: editProfile.name,
      git_username: editProfile.git_username,
      git_email: editProfile.git_email,
      ssh_key_path: editProfile.ssh_key_path || "",
    };

    try {
      await invokeTauri("save_profile", { profile: profileToSave });
      setEditing(false);
      setEditProfile(null);
      await loadData();
    } catch (e) {
      alert("Failed to save profile: " + e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmApp("Delete this identity profile?"))) return;
    try {
      await invokeTauri("delete_profile", { id });
      if (activeId === id) setActiveId(null);
      await loadData();
    } catch (e) {
      alert("Failed to delete profile: " + e);
    }
  };

  const startAdd = () => {
    setEditing(true);
    setEditProfile({
      id: "",
      name: "",
      git_username: "",
      git_email: "",
      ssh_key_path: "",
    });
  };

  return (
    <div className="gh-identity-profiles">
      <div className="gh-identity-profiles__header">
        <p className="gh-identity-profiles__hint">
          Use profiles to swap git author name, email, and SSH key — for example work vs personal.
          {!repoPath && " Open a repository to apply a profile to that repo."}
        </p>
        {!editing && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={startAdd}>
            <Plus size={14} /> Add profile
          </button>
        )}
      </div>

      {editing && editProfile ? (
        <div className="gh-identity-profiles__form">
          <label className="gh-identity-profiles__label">
            Profile name
            <input
              className="ghd-filter-input"
              value={editProfile.name || ""}
              placeholder="Work / Personal"
              onChange={(e) => setEditProfile({ ...editProfile, name: e.target.value })}
            />
          </label>
          <label className="gh-identity-profiles__label">
            Git username
            <input
              className="ghd-filter-input"
              value={editProfile.git_username || ""}
              placeholder="john_doe"
              onChange={(e) => setEditProfile({ ...editProfile, git_username: e.target.value })}
            />
          </label>
          <label className="gh-identity-profiles__label">
            Git email
            <input
              className="ghd-filter-input"
              value={editProfile.git_email || ""}
              placeholder="john@example.com"
              onChange={(e) => setEditProfile({ ...editProfile, git_email: e.target.value })}
            />
          </label>
          <label className="gh-identity-profiles__label">
            SSH key path (optional)
            <input
              className="ghd-filter-input"
              value={editProfile.ssh_key_path || ""}
              placeholder="/home/user/.ssh/id_ed25519"
              onChange={(e) => setEditProfile({ ...editProfile, ssh_key_path: e.target.value })}
            />
          </label>
          <div className="gh-identity-profiles__form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditing(false);
                setEditProfile(null);
              }}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void handleSave()}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <ul className="gh-identity-profiles__list">
          <li>
            <button
              type="button"
              className={`gh-identity-profiles__row${!activeId ? " gh-identity-profiles__row--active" : ""}`}
              onClick={() => void handleSwitch(null)}
            >
              {!activeId ? <Check size={14} className="gh-identity-profiles__check" /> : <span className="gh-identity-profiles__check-spacer" />}
              <span>
                <span className="gh-identity-profiles__name">System default</span>
                <span className="gh-identity-profiles__meta">Uses your global git config</span>
              </span>
            </button>
          </li>
          {profiles.length === 0 ? (
            <li className="gh-identity-profiles__empty">No custom profiles yet.</li>
          ) : (
            profiles.map((p) => (
              <li key={p.id} className="gh-identity-profiles__item">
                <button
                  type="button"
                  className={`gh-identity-profiles__row${p.id === activeId ? " gh-identity-profiles__row--active" : ""}`}
                  onClick={() => void handleSwitch(p.id)}
                >
                  {p.id === activeId ? (
                    <Check size={14} className="gh-identity-profiles__check" />
                  ) : (
                    <span className="gh-identity-profiles__check-spacer" />
                  )}
                  <span>
                    <span className="gh-identity-profiles__name">{p.name}</span>
                    <span className="gh-identity-profiles__meta">
                      {p.git_username} · {p.git_email}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="ghd-icon-btn"
                  title="Edit profile"
                  onClick={() => {
                    setEditing(true);
                    setEditProfile(p);
                  }}
                >
                  <Settings size={14} />
                </button>
                <button
                  type="button"
                  className="ghd-icon-btn"
                  title="Delete profile"
                  onClick={() => void handleDelete(p.id)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
