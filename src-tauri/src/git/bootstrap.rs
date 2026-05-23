use crate::path_safety::resolve_repo_file;
use git2::Repository;
use std::fs;
use std::path::Path;

#[tauri::command]
pub fn write_repo_file(repo_path: String, file_path: String, content: String) -> Result<(), String> {
    let full = resolve_repo_file(&repo_path, &file_path)?;
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {e}"))?;
    }
    fs::write(&full, content.as_bytes()).map_err(|e| format!("Failed to write file: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn repo_has_commits(repo_path: String) -> Result<bool, String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{e}"))?;
    if repo.is_empty().unwrap_or(true) {
        return Ok(false);
    }
    let has_head = repo.head().is_ok();
    Ok(has_head)
}

#[tauri::command]
pub fn path_is_empty_dir(path: String) -> Result<bool, String> {
    let p = Path::new(path.trim());
    if !p.exists() {
        return Ok(true);
    }
    if !p.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    let mut entries = fs::read_dir(p).map_err(|e| format!("{e}"))?;
    Ok(entries.next().is_none())
}
