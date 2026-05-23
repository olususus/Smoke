use git2::{Repository, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: String,
    pub is_staged: bool,
    pub is_conflict: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkingTreeStatus {
    pub staged: Vec<FileStatus>,
    pub unstaged: Vec<FileStatus>,
    pub untracked: Vec<FileStatus>,
    pub conflicts: Vec<FileStatus>,
    pub is_clean: bool,
}

#[tauri::command]
pub fn get_status(repo_path: String) -> Result<WorkingTreeStatus, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    let mut conflicts = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        if s.is_conflicted() {
            conflicts.push(FileStatus { path, status: "conflict".into(), is_staged: false, is_conflict: true });
            continue;
        }

        if s.is_index_new() || s.is_index_modified() || s.is_index_deleted() || s.is_index_renamed() {
            let st = if s.is_index_new() { "new" } else if s.is_index_deleted() { "deleted" } else if s.is_index_renamed() { "renamed" } else { "modified" };
            staged.push(FileStatus { path: path.clone(), status: st.into(), is_staged: true, is_conflict: false });
        }

        if s.is_wt_modified() || s.is_wt_deleted() || s.is_wt_renamed() {
            let st = if s.is_wt_deleted() { "deleted" } else if s.is_wt_renamed() { "renamed" } else { "modified" };
            unstaged.push(FileStatus { path: path.clone(), status: st.into(), is_staged: false, is_conflict: false });
        } else if s.is_wt_new() {
            untracked.push(FileStatus { path, status: "untracked".into(), is_staged: false, is_conflict: false });
        }
    }

    let is_clean = staged.is_empty() && unstaged.is_empty() && untracked.is_empty() && conflicts.is_empty();
    Ok(WorkingTreeStatus { staged, unstaged, untracked, conflicts, is_clean })
}

#[tauri::command]
pub fn stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let mut index = repo.index().map_err(|e| format!("{}", e))?;
    let abs_path = Path::new(&repo_path).join(&file_path);
    if abs_path.exists() {
        index.add_path(Path::new(&file_path)).map_err(|e| format!("{}", e))?;
    } else {
        index.remove_path(Path::new(&file_path)).map_err(|e| format!("{}", e))?;
    }
    index.write().map_err(|e| format!("{}", e))
}

#[tauri::command]
pub fn unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let head = repo.head().and_then(|h| h.peel_to_commit()).ok();
    if let Some(commit) = head {
        repo.reset_default(Some(commit.as_object()), [file_path.as_str()]).map_err(|e| format!("{}", e))?;
    } else {
        let mut index = repo.index().map_err(|e| format!("{}", e))?;
        index.remove_path(Path::new(&file_path)).map_err(|e| format!("{}", e))?;
        index.write().map_err(|e| format!("{}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn stage_all(repo_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let mut index = repo.index().map_err(|e| format!("{}", e))?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None).map_err(|e| format!("{}", e))?;
    index.update_all(["*"].iter(), None).map_err(|e| format!("{}", e))?;
    index.write().map_err(|e| format!("{}", e))
}

#[tauri::command]
pub fn unstage_all(repo_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    if let Ok(commit) = repo.head().and_then(|h| h.peel_to_commit()) {
        repo.reset_default(Some(commit.as_object()), ["*"]).map_err(|e| format!("{}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn create_commit(
    repo_path: String,
    message: String,
    sign: Option<bool>,
) -> Result<String, String> {
    if sign.unwrap_or(false) {
        return super::cli_sync::cli_commit(&repo_path, &message, true);
    }

    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let mut index = repo.index().map_err(|e| format!("{}", e))?;
    let tree_oid = index.write_tree().map_err(|e| format!("{}", e))?;
    let tree = repo.find_tree(tree_oid).map_err(|e| format!("{}", e))?;
    let sig = repo.signature().map_err(|e| format!("Set git user.name/email: {}", e))?;
    let parent = repo.head().and_then(|h| h.peel_to_commit()).ok();
    let parents: Vec<&git2::Commit> = parent.iter().collect();
    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| format!("{}", e))?;
    Ok(oid.to_string())
}

#[tauri::command]
pub fn discard_file_changes(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let head = repo.head().map_err(|e| format!("{}", e))?;
    let obj = head.peel(git2::ObjectType::Tree).map_err(|e| format!("{}", e))?;
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force().path(Path::new(&file_path));
    repo.checkout_tree(&obj, Some(&mut checkout))
        .map_err(|e| format!("Discard failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn stage_hunk(repo_path: String, patch: String) -> Result<(), String> {
    super::cli_sync::cli_apply_cached(&repo_path, &patch)
}

#[tauri::command]
pub fn unstage_hunk(repo_path: String, patch: String) -> Result<(), String> {
    super::cli_sync::cli_apply_cached_reverse(&repo_path, &patch)
}

#[tauri::command]
pub fn discard_all_changes(repo_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let obj = repo
        .head()
        .map_err(|e| format!("{}", e))?
        .peel(git2::ObjectType::Commit)
        .map_err(|e| format!("{}", e))?;
    repo.reset(&obj, git2::ResetType::Hard, None)
        .map_err(|e| format!("Discard all failed: {}", e))?;
    Ok(())
}
