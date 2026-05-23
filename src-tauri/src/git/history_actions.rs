use git2::{CherrypickOptions, Repository, RevertOptions};
use serde::Serialize;
use crate::git::sync::list_conflict_paths;

#[derive(Debug, Serialize)]
pub struct RevertResult {
    pub ok: bool,
    pub message: String,
    pub conflict_paths: Vec<String>,
}

#[tauri::command]
pub fn amend_commit(repo_path: String, message: Option<String>) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let head = repo
        .head()
        .map_err(|e| format!("No HEAD: {}", e))?
        .peel_to_commit()
        .map_err(|e| format!("{}", e))?;

    if head.parent_count() == 0 {
        return Err("Cannot amend the root commit".into());
    }

    let parent = head
        .parent(0)
        .map_err(|e| format!("Failed to get parent: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("{}", e))?;
    let tree_oid = index.write_tree().map_err(|e| format!("{}", e))?;
    let tree = repo.find_tree(tree_oid).map_err(|e| format!("{}", e))?;
    let sig = repo
        .signature()
        .map_err(|e| format!("Set git user.name/email: {}", e))?;

    let msg = message.unwrap_or_else(|| {
        head.summary()
            .ok()
            .flatten()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Amended commit".to_string())
    });

    repo.commit(Some("HEAD"), &sig, &sig, &msg, &tree, &[&parent])
        .map_err(|e| format!("Amend failed: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn revert_commit(repo_path: String, commit_hash: String) -> Result<RevertResult, String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let oid = git2::Oid::from_str(&commit_hash).map_err(|e| format!("Invalid hash: {}", e))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Commit not found: {}", e))?;

    let mut opts = RevertOptions::new();
    repo.revert(&commit, Some(&mut opts))
        .map_err(|e| format!("Revert failed: {}", e))?;

    let conflict_paths = list_conflict_paths(&repo)?;
    let has_conflicts = !conflict_paths.is_empty()
        || repo
            .index()
            .map(|i| i.has_conflicts())
            .unwrap_or(false);

    if has_conflicts {
        Ok(RevertResult {
            ok: false,
            message: format!(
                "Revert has {} conflict(s). Resolve them in Changes.",
                conflict_paths.len()
            ),
            conflict_paths,
        })
    } else {
        Ok(RevertResult {
            ok: true,
            message: "Reverted commit. Review changes and commit when ready.".to_string(),
            conflict_paths: vec![],
        })
    }
}

#[tauri::command]
pub fn cherry_pick_commit(repo_path: String, commit_hash: String) -> Result<RevertResult, String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let oid = git2::Oid::from_str(&commit_hash).map_err(|e| format!("Invalid hash: {}", e))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Commit not found: {}", e))?;

    let mut opts = CherrypickOptions::new();
    repo.cherrypick(&commit, Some(&mut opts))
        .map_err(|e| format!("Cherry-pick failed: {}", e))?;

    let conflict_paths = list_conflict_paths(&repo)?;
    let has_conflicts = !conflict_paths.is_empty()
        || repo
            .index()
            .map(|i| i.has_conflicts())
            .unwrap_or(false);

    if has_conflicts {
        Ok(RevertResult {
            ok: false,
            message: format!(
                "Cherry-pick has {} conflict(s). Resolve them in Changes.",
                conflict_paths.len()
            ),
            conflict_paths,
        })
    } else {
        Ok(RevertResult {
            ok: true,
            message: "Cherry-pick applied. Review changes and commit when ready.".to_string(),
            conflict_paths: vec![],
        })
    }
}
