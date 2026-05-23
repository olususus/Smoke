use git2::Repository;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub last_commit_hash: String,
    pub last_commit_summary: String,
}

#[tauri::command]
pub fn get_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let _head_ref = repo.head().ok().and_then(|h| h.target());
    let mut branches = Vec::new();

    if let Ok(branch_iter) = repo.branches(None) {
        for branch_result in branch_iter.flatten() {
            let (branch, branch_type) = branch_result;
            let name = branch.name().ok().flatten().unwrap_or("").to_string();
            if name.is_empty() { continue; }

            let is_remote = branch_type == git2::BranchType::Remote;
            let is_head = branch.is_head();

            let mut upstream = branch
                .upstream()
                .ok()
                .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

            if !is_remote && upstream.is_none() {
                let local_name = name.clone();
                let remote_ref = format!("refs/remotes/origin/{local_name}");
                if repo.refname_to_id(&remote_ref).is_ok() {
                    upstream = Some(format!("origin/{local_name}"));
                }
            }

            let (last_commit_hash, last_commit_summary) = branch.get().target()
                .and_then(|oid| repo.find_commit(oid).ok())
                .map(|c| {
                    (
                        c.id().to_string()[..7].to_string(),
                        c.summary().ok().and_then(|x| x).unwrap_or("").to_string(),
                    )
                })
                .unwrap_or_default();

            branches.push(BranchInfo {
                name, is_head, is_remote, upstream,
                last_commit_hash, last_commit_summary,
            });
        }
    }

    // Sort: HEAD first, then local, then remote
    branches.sort_by(|a, b| {
        b.is_head.cmp(&a.is_head)
            .then(a.is_remote.cmp(&b.is_remote))
            .then(a.name.cmp(&b.name))
    });

    Ok(branches)
}

#[tauri::command]
pub fn checkout_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let (obj, reference) = repo.revparse_ext(&branch_name)
        .map_err(|e| format!("Failed to find branch '{}': {}", branch_name, e))?;

    repo.checkout_tree(&obj, None)
        .map_err(|e| format!("Failed to checkout: {}", e))?;

    if let Some(reference) = reference {
        repo.set_head(reference.name().unwrap_or(&format!("refs/heads/{}", branch_name)))
            .map_err(|e| format!("Failed to set HEAD: {}", e))?;
    } else {
        repo.set_head_detached(obj.id())
            .map_err(|e| format!("Failed to detach HEAD: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn create_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let head = repo.head()
        .and_then(|h| h.peel_to_commit())
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

    repo.branch(&branch_name, &head, false)
        .map_err(|e| format!("Failed to create branch: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut branch = repo.find_branch(&branch_name, git2::BranchType::Local)
        .map_err(|e| format!("Failed to find branch: {}", e))?;

    if branch.is_head() {
        return Err("Cannot delete the currently checked-out branch".to_string());
    }

    branch.delete()
        .map_err(|e| format!("Failed to delete branch: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn rename_branch(repo_path: String, old_name: String, new_name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let new_name = new_name.trim();
    if new_name.is_empty() {
        return Err("Branch name cannot be empty".into());
    }
    let mut branch = repo
        .find_branch(&old_name, git2::BranchType::Local)
        .map_err(|e| format!("Failed to find branch: {}", e))?;
    branch
        .rename(&new_name, true)
        .map_err(|e| format!("Failed to rename branch: {}", e))?;
    Ok(())
}
