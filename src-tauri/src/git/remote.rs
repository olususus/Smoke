use git2::build::RepoBuilder;
use git2::{FetchOptions, Repository};
use serde::{Deserialize, Serialize};
use std::path::Path;

use super::credentials::apply_credentials;

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
}

#[tauri::command]
pub fn get_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let names = repo.remotes()
        .map_err(|e| format!("Failed to list remotes: {}", e))?;

    let mut remotes = Vec::new();
    for name_result in names.iter() {
        if let Ok(Some(name)) = name_result {
            if let Ok(remote) = repo.find_remote(name) {
                remotes.push(RemoteInfo {
                    name: name.to_string(),
                    url: remote.url().unwrap_or("").to_string(),
                });
            }
        }
    }

    Ok(remotes)
}

/// Clone a repository
#[tauri::command]
pub fn clone_repo(url: String, dest_path: String) -> Result<String, String> {
    let mut callbacks = git2::RemoteCallbacks::new();
    apply_credentials(&mut callbacks);
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    RepoBuilder::new()
        .fetch_options(fetch_opts)
        .clone(&url, Path::new(&dest_path))
        .map_err(|e| format!("Failed to clone: {e}"))?;
    Ok(dest_path)
}

/// Init a new repository
#[tauri::command]
pub fn init_repo(path: String) -> Result<String, String> {
    Repository::init(&path)
        .map_err(|e| format!("Failed to init repo: {}", e))?;
    Ok(path)
}

/// Check if a path is a valid git repo (normal or worktree layout).
#[tauri::command]
pub fn is_git_repo(path: String) -> Result<bool, String> {
    let p = path.trim();
    if p.is_empty() {
        return Ok(false);
    }
    if Repository::open(p).is_ok() {
        return Ok(true);
    }
    let dot_git = Path::new(p).join(".git");
    Ok(dot_git.exists())
}

#[tauri::command]
pub fn add_remote(repo_path: String, name: String, url: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    repo.remote(&name, &url)
        .map_err(|e| format!("Failed to add remote: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn remove_remote(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    repo.remote_delete(&name)
        .map_err(|e| format!("Failed to remove remote: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn set_remote_url(repo_path: String, name: String, url: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    repo.remote_set_url(&name, &url)
        .map_err(|e| format!("Failed to set URL: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn rename_remote(repo_path: String, old_name: String, new_name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    repo.remote_rename(&old_name, &new_name)
        .map_err(|e| format!("Failed to rename remote: {}", e))?;
    Ok(())
}

/// Open the repository directory in the system file manager.
#[tauri::command]
pub fn open_repo_folder(repo_path: String) -> Result<(), String> {
    open::that(&repo_path).map_err(|e| format!("Failed to open folder: {}", e))
}
