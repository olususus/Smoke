use crate::path_safety::{ssh_command_for_key, validate_ssh_key_path};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub git_username: String,
    pub git_email: String,
    pub ssh_key_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfilePublic {
    pub id: String,
    pub name: String,
    pub git_username: String,
    pub git_email: String,
    pub ssh_key_path: Option<String>,
}

fn profile_public(p: &Profile) -> ProfilePublic {
    ProfilePublic {
        id: p.id.clone(),
        name: p.name.clone(),
        git_username: p.git_username.clone(),
        git_email: p.git_email.clone(),
        ssh_key_path: p.ssh_key_path.clone(),
    }
}

fn config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("~/.config"));
    base.join("smoke")
}

fn profiles_file() -> PathBuf {
    config_dir().join("profiles.json")
}

fn load_profiles_internal() -> Result<Vec<Profile>, String> {
    let path = profiles_file();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read profiles file: {}", e))?;
    let profiles: Vec<Profile> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse profiles: {}", e))?;
    Ok(profiles)
}

fn save_profiles_internal(profiles: &[Profile]) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    let json = serde_json::to_string_pretty(profiles)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;
    fs::write(profiles_file(), json)
        .map_err(|e| format!("Failed to write profiles file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_profiles() -> Result<Vec<ProfilePublic>, String> {
    Ok(load_profiles_internal()?
        .iter()
        .map(profile_public)
        .collect())
}

#[tauri::command]
pub fn save_profile(profile: Profile) -> Result<(), String> {
    let mut profiles = load_profiles_internal()?;
    if let Some(pos) = profiles.iter().position(|p| p.id == profile.id) {
        profiles[pos] = profile;
    } else {
        profiles.push(profile);
    }
    save_profiles_internal(&profiles)
}

#[tauri::command]
pub fn delete_profile(id: String) -> Result<(), String> {
    let mut profiles = load_profiles_internal()?;
    profiles.retain(|p| p.id != id);
    save_profiles_internal(&profiles)
}

#[tauri::command]
pub fn switch_profile(repo_path: Option<String>, id: String) -> Result<(), String> {
    let profiles = load_profiles_internal()?;
    let profile = profiles.iter().find(|p| p.id == id)
        .ok_or_else(|| format!("Profile not found: {}", id))?;

    if let Some(ref path) = repo_path {
        let repo = Repository::open(path)
            .map_err(|e| format!("Failed to open repo to switch profile: {}", e))?;
        let mut config = repo.config()
            .map_err(|e| format!("Failed to load repo config: {}", e))?;
        
        config.set_str("user.name", &profile.git_username)
            .map_err(|e| format!("Failed to set git user.name: {}", e))?;
        config.set_str("user.email", &profile.git_email)
            .map_err(|e| format!("Failed to set git user.email: {}", e))?;
        
        if let Some(ref ssh_path) = profile.ssh_key_path {
            if !ssh_path.trim().is_empty() {
                let key = validate_ssh_key_path(ssh_path)?;
                let cmd = ssh_command_for_key(&key);
                config
                    .set_str("core.sshCommand", &cmd)
                    .map_err(|e| format!("Failed to set ssh command: {}", e))?;
            } else {
                let _ = config.remove("core.sshCommand");
            }
        } else {
            let _ = config.remove("core.sshCommand");
        }
    }

    let session_file = config_dir().join("current_profile.txt");
    fs::write(session_file, &id)
        .map_err(|e| format!("Failed to save active profile state: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn clear_active_profile(repo_path: Option<String>) -> Result<(), String> {
    if let Some(ref path) = repo_path {
        let repo = Repository::open(path)
            .map_err(|e| format!("Failed to open repo to clear profile: {}", e))?;
        let mut config = repo
            .config()
            .map_err(|e| format!("Failed to load repo config: {}", e))?;
        let _ = config.remove("user.name");
        let _ = config.remove("user.email");
        let _ = config.remove("core.sshCommand");
    }

    let session_file = config_dir().join("current_profile.txt");
    if session_file.exists() {
        fs::remove_file(&session_file)
            .map_err(|e| format!("Failed to clear active profile state: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_active_profile_id() -> Result<Option<String>, String> {
    let path = config_dir().join("current_profile.txt");
    if path.exists() {
        let id = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read active profile state: {}", e))?;
        Ok(Some(id.trim().to_string()))
    } else {
        Ok(None)
    }
}
