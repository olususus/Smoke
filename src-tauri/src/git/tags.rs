use git2::Repository;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagInfo {
    pub name: String,
    pub target: String,
    pub message: Option<String>,
}

#[tauri::command]
pub fn list_tags(repo_path: String) -> Result<Vec<TagInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let mut tags = Vec::new();

    if let Ok(tag_names) = repo.tag_names(None) {
        for name_result in tag_names.iter() {
            let Ok(Some(name)) = name_result else { continue };
            let full_name = format!("refs/tags/{name}");
            let target = repo
                .refname_to_id(&full_name)
                .map(|oid| oid.to_string()[..7].to_string())
                .unwrap_or_default();
            let message = repo
                .find_reference(&full_name)
                .ok()
                .and_then(|r| r.peel_to_tag().ok())
                .and_then(|t| {
                    t.message()
                        .ok()
                        .flatten()
                        .map(|m| m.to_string())
                });
            tags.push(TagInfo {
                name: name.to_string(),
                target,
                message,
            });
        }
    }

    tags.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(tags)
}

#[tauri::command]
pub fn create_tag(repo_path: String, name: String, message: Option<String>) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let head = repo
        .head()
        .and_then(|h| h.peel_to_commit())
        .map_err(|e| format!("{}", e))?;
    let sig = repo.signature().map_err(|e| format!("{}", e))?;
    let target = head.as_object();

    if let Some(msg) = message.filter(|m| !m.trim().is_empty()) {
        repo.tag(&name, &target, &sig, &msg, false)
            .map_err(|e| format!("{}", e))?;
    } else {
        repo.tag_lightweight(&name, &target, false)
            .map_err(|e| format!("{}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn push_tag(repo_path: String, name: String) -> Result<(), String> {
    super::cli_sync::cli_push_tag(&repo_path, &name)
}

#[tauri::command]
pub fn delete_tag(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let refname = format!("refs/tags/{name}");
    let mut reference = repo
        .find_reference(&refname)
        .map_err(|e| format!("Tag not found: {}", e))?;
    reference.delete().map_err(|e| format!("{}", e))?;
    Ok(())
}
