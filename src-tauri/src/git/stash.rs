use git2::{Repository, StashApplyOptions, StashFlags};
use serde::{Deserialize, Serialize};

use super::diff::get_commit_diff;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StashEntry {
    pub index: usize,
    pub message: String,
    pub oid: String,
}

#[tauri::command]
pub fn stash_save(repo_path: String, message: Option<String>) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let sig = repo
        .signature()
        .map_err(|e| format!("Set git user.name/email: {}", e))?;
    let msg = message.unwrap_or_else(|| "WIP".to_string());
    repo.stash_save(&sig, &msg, Some(StashFlags::INCLUDE_UNTRACKED))
        .map_err(|e| format!("Stash failed: {}", e))?;
    Ok(())
}

fn stash_count(repo: &mut Repository) -> usize {
    let mut count = 0usize;
    let _ = repo.stash_foreach(|_, _, _| {
        count += 1;
        true
    });
    count
}

#[tauri::command]
pub fn stash_pop(repo_path: String, stash_index: Option<usize>) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let index = stash_index.unwrap_or(0);
    if stash_count(&mut repo) == 0 {
        return Err("No stashes to pop".into());
    }
    repo.stash_pop(index, None)
        .map_err(|e| format!("Stash pop failed: {}", e))?;
    Ok(())
}

/// Apply stash (restore to working tree) without removing it from the stash list.
#[tauri::command]
pub fn stash_apply(repo_path: String, stash_index: Option<usize>) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let index = stash_index.unwrap_or(0);
    if stash_count(&mut repo) == 0 {
        return Err("No stashes to apply".into());
    }
    repo.stash_apply(index, Some(&mut StashApplyOptions::new()))
        .map_err(|e| format!("Stash apply failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn stash_drop(repo_path: String, stash_index: Option<usize>) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let index = stash_index.unwrap_or(0);
    if stash_count(&mut repo) == 0 {
        return Err("No stashes to discard".into());
    }
    repo.stash_drop(index)
        .map_err(|e| format!("Discard stash failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_stash_diff(repo_path: String, stash_index: usize) -> Result<super::diff::DiffResult, String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let mut oid: Option<String> = None;
    repo.stash_foreach(|idx, _, o| {
        if idx == stash_index {
            oid = Some(o.to_string());
        }
        true
    })
    .map_err(|e| format!("{}", e))?;
    let hash = oid.ok_or_else(|| format!("Stash #{stash_index} not found"))?;
    get_commit_diff(repo_path, hash)
}

#[tauri::command]
pub fn stash_list(repo_path: String) -> Result<Vec<StashEntry>, String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let mut entries = Vec::new();
    repo.stash_foreach(|index, message, oid| {
        entries.push(StashEntry {
            index,
            message: message.to_string(),
            oid: oid.to_string(),
        });
        true
    })
    .map_err(|e| format!("{}", e))?;
    Ok(entries)
}
