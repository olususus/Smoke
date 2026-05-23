use git2::Repository;
use serde::{Deserialize, Serialize};

use super::cli_sync;
use super::sync::list_conflict_paths;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub ok: bool,
    pub message: String,
    pub conflict_paths: Vec<String>,
}

fn conflicts_after(repo_path: &str) -> Result<Vec<String>, String> {
    let repo = Repository::open(repo_path).map_err(|e| format!("{}", e))?;
    list_conflict_paths(&repo)
}

#[tauri::command]
pub fn rebase_onto(repo_path: String, upstream_branch: String) -> Result<SyncResult, String> {
    cli_sync::cli_rebase(&repo_path, &upstream_branch)?;
    let conflict_paths = conflicts_after(&repo_path)?;
    if conflict_paths.is_empty() {
        Ok(SyncResult {
            ok: true,
            message: format!("Rebased onto {upstream_branch}."),
            conflict_paths: vec![],
        })
    } else {
        Ok(SyncResult {
            ok: false,
            message: format!(
                "Rebase stopped with {} conflict(s). Resolve them in Changes.",
                conflict_paths.len()
            ),
            conflict_paths,
        })
    }
}

#[tauri::command]
pub fn rebase_abort(repo_path: String) -> Result<(), String> {
    cli_sync::cli_rebase_abort(&repo_path)
}

#[tauri::command]
pub fn rebase_continue(repo_path: String) -> Result<SyncResult, String> {
    cli_sync::cli_rebase_continue(&repo_path)?;
    let conflict_paths = conflicts_after(&repo_path)?;
    if conflict_paths.is_empty() {
        Ok(SyncResult {
            ok: true,
            message: "Rebase continued.".to_string(),
            conflict_paths: vec![],
        })
    } else {
        Ok(SyncResult {
            ok: false,
            message: format!("Rebase has {} remaining conflict(s).", conflict_paths.len()),
            conflict_paths,
        })
    }
}

#[tauri::command]
pub fn squash_merge_branch(repo_path: String, branch_name: String) -> Result<SyncResult, String> {
    cli_sync::cli_squash_merge(&repo_path, &branch_name)?;
    Ok(SyncResult {
        ok: true,
        message: format!("Squash-merged {branch_name} into current branch."),
        conflict_paths: vec![],
    })
}
