use crate::path_safety::resolve_repo_file;
use git2::{Repository, RepositoryState};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictDetail {
    pub path: String,
    pub base: Option<String>,
    pub ours: String,
    pub theirs: String,
    pub working: String,
}

fn blob_as_string(repo: &Repository, oid: git2::Oid) -> Result<String, String> {
    let blob = repo.find_blob(oid).map_err(|e| format!("{}", e))?;
    Ok(String::from_utf8_lossy(blob.content()).into_owned())
}

fn read_working_file(repo_path: &str, file_path: &str) -> Result<String, String> {
    let p = resolve_repo_file(repo_path, file_path)?;
    std::fs::read_to_string(&p).map_err(|e| format!("Failed to read {}: {}", file_path, e))
}

fn conflict_from_index(repo: &Repository, repo_path: &str, file_path: &str) -> Result<ConflictDetail, String> {
    let index = repo.index().map_err(|e| format!("{}", e))?;
    let path = Path::new(file_path);

    for conflict in index.conflicts().map_err(|e| format!("{}", e))? {
        let c = conflict.map_err(|e| format!("{}", e))?;
        let matches = c
            .our
            .as_ref()
            .map(|e| Path::new(std::str::from_utf8(&e.path).unwrap_or("")) == path)
            .unwrap_or(false)
            || c
                .their
                .as_ref()
                .map(|e| Path::new(std::str::from_utf8(&e.path).unwrap_or("")) == path)
                .unwrap_or(false);
        if !matches {
            continue;
        }

        let base = c
            .ancestor
            .map(|e| blob_as_string(repo, e.id))
            .transpose()?;
        let ours = c
            .our
            .map(|e| blob_as_string(repo, e.id))
            .transpose()?
            .unwrap_or_default();
        let theirs = c
            .their
            .map(|e| blob_as_string(repo, e.id))
            .transpose()?
            .unwrap_or_default();
        let working = read_working_file(repo_path, file_path).unwrap_or_default();

        return Ok(ConflictDetail {
            path: file_path.to_string(),
            base,
            ours,
            theirs,
            working,
        });
    }

    Err(format!("No index conflict for {file_path}"))
}

#[tauri::command]
pub fn get_conflict_detail(repo_path: String, file_path: String) -> Result<ConflictDetail, String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    conflict_from_index(&repo, &repo_path, &file_path).or_else(|_| {
        Ok(ConflictDetail {
            path: file_path.clone(),
            base: None,
            ours: String::new(),
            theirs: String::new(),
            working: read_working_file(&repo_path, &file_path)?,
        })
    })
}

#[tauri::command]
pub fn resolve_conflict(
    repo_path: String,
    file_path: String,
    resolution: String,
    content: Option<String>,
) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let full_path = resolve_repo_file(&repo_path, &file_path)?;

    let text = match resolution.as_str() {
        "ours" => {
            let detail = conflict_from_index(&repo, &repo_path, &file_path)?;
            detail.ours
        }
        "theirs" => {
            let detail = conflict_from_index(&repo, &repo_path, &file_path)?;
            detail.theirs
        }
        "manual" => content.ok_or_else(|| "Missing resolved content.".to_string())?,
        other => return Err(format!("Unknown resolution: {other}")),
    };

    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("{}", e))?;
    }
    std::fs::write(&full_path, &text).map_err(|e| format!("{}", e))?;

    let mut index = repo.index().map_err(|e| format!("{}", e))?;
    index
        .add_path(Path::new(&file_path))
        .map_err(|e| format!("{}", e))?;
    index.write().map_err(|e| format!("{}", e))?;

    if !index.has_conflicts() && repo.state() == RepositoryState::Merge {
        super::sync::finalize_merge_commit(&repo)?;
    }

    Ok(())
}

#[tauri::command]
pub fn abort_merge(repo_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    repo.cleanup_state()
        .map_err(|e| format!("Abort merge failed: {}", e))?;
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
        .map_err(|e| format!("{}", e))?;
    Ok(())
}
