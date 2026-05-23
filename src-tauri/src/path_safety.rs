use git2::Repository;
use std::path::{Component, Path, PathBuf};

/// Resolves `repo_path` + relative `file_path` and ensures the result stays inside the repo workdir.
pub fn resolve_repo_file(repo_path: &str, file_path: &str) -> Result<PathBuf, String> {
    if file_path.is_empty() {
        return Err("Empty file path".to_string());
    }
    if file_path.contains('\0') {
        return Err("Invalid file path".to_string());
    }

    let rel = Path::new(file_path);
    if rel.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }
    for component in rel.components() {
        match component {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Path escapes repository".to_string());
            }
            _ => {}
        }
    }

    let repo = Repository::open(repo_path).map_err(|e| format!("{e}"))?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Bare repository has no working directory".to_string())?;

    let canonical_root = workdir
        .canonicalize()
        .map_err(|e| format!("Failed to resolve repository root: {e}"))?;

    let full = workdir.join(rel);
    let canonical = if full.exists() {
        full.canonicalize()
            .map_err(|e| format!("Failed to resolve file path: {e}"))?
    } else if let Some(parent) = full.parent() {
        if !parent.exists() {
            return Err("Parent directory does not exist".to_string());
        }
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("Failed to resolve parent path: {e}"))?;
        let joined = canonical_parent.join(
            full.file_name()
                .ok_or_else(|| "Invalid file path".to_string())?,
        );
        if !joined.starts_with(&canonical_root) {
            return Err("Path escapes repository".to_string());
        }
        return Ok(joined);
    } else {
        return Err("Invalid file path".to_string());
    };

    if !canonical.starts_with(&canonical_root) {
        return Err("Path escapes repository".to_string());
    }

    Ok(canonical)
}

/// Validates an SSH private key path for use with `core.sshCommand`.
pub fn validate_ssh_key_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("SSH key path is empty".to_string());
    }
    if trimmed.contains([' ', '\t', '\n', '\0', ';', '|', '&', '$', '`']) {
        return Err("SSH key path contains invalid characters".to_string());
    }

    let path = if trimmed.starts_with("~/") {
        let home = dirs::home_dir().ok_or_else(|| "Home directory not found".to_string())?;
        home.join(trimmed.trim_start_matches("~/"))
    } else if trimmed == "~" {
        dirs::home_dir().ok_or_else(|| "Home directory not found".to_string())?
    } else {
        PathBuf::from(trimmed)
    };

    let canonical = path
        .canonicalize()
        .map_err(|_| "SSH key file not found".to_string())?;

    let ssh_dir = dirs::home_dir()
        .map(|h| h.join(".ssh"))
        .and_then(|p| p.canonicalize().ok());

    if let Some(ref ssh) = ssh_dir {
        if !canonical.starts_with(ssh) {
            return Err("SSH key must be under ~/.ssh".to_string());
        }
    }

    if !canonical.is_file() {
        return Err("SSH key path is not a file".to_string());
    }

    Ok(canonical)
}

pub fn ssh_command_for_key(key_path: &Path) -> String {
    let key = key_path.to_string_lossy();
    format!("ssh -i {key} -o IdentitiesOnly=yes -o BatchMode=yes")
}
