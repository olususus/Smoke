use std::fs;
use std::path::PathBuf;

fn config_dir() -> PathBuf {
    dirs::config_dir().unwrap_or_else(|| PathBuf::from("~/.config"))
}

fn token_backup_file() -> PathBuf {
    config_dir().join("smoke").join("github_token")
}

/// Human-readable path for error messages.
pub fn token_backup_path_display() -> String {
    token_backup_file().display().to_string()
}

#[cfg(unix)]
fn set_private_file_permissions(path: &PathBuf) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|e| format!("Failed to set token file permissions: {e}"))
}

#[cfg(not(unix))]
fn set_private_file_permissions(_path: &PathBuf) -> Result<(), String> {
    Ok(())
}

pub fn store_token(token: &str) -> Result<(), String> {
    if token.trim().is_empty() {
        return Err("GitHub token is empty.".to_string());
    }

    let path = token_backup_file();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Could not create config directory {}: {e}",
                parent.display()
            )
        })?;
    }
    fs::write(&path, token).map_err(|e| {
        format!(
            "Could not write GitHub token to {}: {e}",
            path.display()
        )
    })?;
    set_private_file_permissions(&path)?;
    Ok(())
}

pub fn read_token() -> Option<String> {
    let token = fs::read_to_string(token_backup_file()).ok()?;
    let token = token.trim().to_string();
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

pub fn delete_token() -> Result<(), String> {
    let path = token_backup_file();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Could not delete token file: {e}"))?;
    }
    Ok(())
}
