use git2::{Repository, Sort};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub message: String,
    pub summary: String,
    pub timestamp: i64,
    pub refs: Vec<String>,
    pub is_head: bool,
    pub author_avatar: String,
}

fn encode_github_login(login: &str) -> String {
    login
        .trim()
        .bytes()
        .flat_map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' => {
                vec![b as char]
            }
            _ => format!("%{b:02X}").chars().collect(),
        })
        .collect()
}

fn github_login_avatar(login: &str) -> String {
    let login = login.trim();
    if login.is_empty() {
        return String::new();
    }
    format!(
        "https://avatars.githubusercontent.com/{}?s=64&v=4",
        encode_github_login(login)
    )
}

fn bot_login_from_name(author_name: &str) -> Option<String> {
    author_name
        .split_whitespace()
        .find(|part| part.contains("[bot]"))
        .map(|s| s.to_string())
}

fn known_bot_login_from_name(author_name: &str) -> Option<String> {
    let first = author_name.split_whitespace().next()?.trim();
    if first.is_empty() {
        return None;
    }
    match first.to_ascii_lowercase().as_str() {
        "claude" => Some("claude[bot]".to_string()),
        _ => None,
    }
}

/// GitHub login from commit email only (never from git display name).
fn github_login_from_email(email: &str, author_name: &str) -> Option<String> {
    let e = email.trim().to_lowercase();
    if let Some(rest) = e.strip_suffix("@users.noreply.github.com") {
        if let Some((_id, login)) = rest.split_once('+') {
            if !login.is_empty() {
                return Some(login.to_string());
            }
        } else if !rest.is_empty() && !rest.chars().all(|c| c.is_ascii_digit()) {
            return Some(rest.to_string());
        }
    }

    if let Some(login) = bot_login_from_name(author_name) {
        return Some(login);
    }

    if e.contains("anthropic") {
        return Some("claude[bot]".to_string());
    }

    known_bot_login_from_name(author_name)
}

fn author_avatar_url(email: &str, author_name: &str) -> String {
    if let Some(login) = github_login_from_email(email, author_name) {
        return github_login_avatar(&login);
    }

    let e = email.trim().to_lowercase();
    if e.is_empty() {
        return String::new();
    }

    let digest = md5::compute(e.as_bytes());
    format!(
        "https://www.gravatar.com/avatar/{:x}?s=64&d=retro",
        digest
    )
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    pub current_branch: String,
    pub is_dirty: bool,
    pub ahead: usize,
    pub behind: usize,
    pub upstream_set: bool,
    pub total_commits: usize,
    pub branches: Vec<String>,
}

#[tauri::command]
pub fn get_history(repo_path: String, max_count: Option<usize>) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let max = max_count.unwrap_or(500);

    let mut ref_map: HashMap<String, Vec<String>> = HashMap::new();
    if let Ok(references) = repo.references() {
        for reference in references.flatten() {
            if let (Ok(name), Some(target)) = (reference.name(), reference.target()) {
                let short_name = name
                    .strip_prefix("refs/heads/")
                    .or_else(|| name.strip_prefix("refs/remotes/"))
                    .or_else(|| name.strip_prefix("refs/tags/"))
                    .unwrap_or(name);
                ref_map
                    .entry(target.to_string())
                    .or_default()
                    .push(short_name.to_string());
            }
        }
    }

    // Get HEAD
    let head_oid = repo.head().ok().and_then(|h| h.target());

    // Walk the commit graph
    let mut revwalk = repo.revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;

    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)
        .map_err(|e| format!("Failed to set sorting: {}", e))?;

    if revwalk.push_head().is_err() {
        // Empty repo or unborn branch — no commits to show yet
        return Ok(Vec::new());
    }

    // Also push all branches to see full graph
    if let Ok(branches) = repo.branches(None) {
        for branch in branches.flatten() {
            if let Some(oid) = branch.0.get().target() {
                let _ = revwalk.push(oid);
            }
        }
    }

    let mut commits = Vec::new();

    for oid_result in revwalk {
        if commits.len() >= max {
            break;
        }

        let oid = oid_result.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo.find_commit(oid)
            .map_err(|e| format!("Failed to find commit {}: {}", oid, e))?;

        let hash = oid.to_string();
        let short_hash = hash[..7.min(hash.len())].to_string();

        let parents: Vec<String> = commit.parent_ids().map(|p| p.to_string()).collect();

        let message = commit.message().unwrap_or("").to_string();
        let summary = message.lines().next().unwrap_or("").to_string();

        let author = commit.author();
        let author_name = author.name().unwrap_or("Unknown").to_string();
        let author_email = author.email().unwrap_or("").to_string();

        let refs = ref_map.get(&hash).cloned().unwrap_or_default();
        let is_head = head_oid.map_or(false, |h| h == oid);

        commits.push(CommitInfo {
            hash,
            short_hash,
            parents,
            author_name: author_name.clone(),
            author_email: author_email.clone(),
            message,
            summary,
            timestamp: commit.time().seconds(),
            refs,
            is_head,
            author_avatar: author_avatar_url(&author_email, &author_name),
        });
    }

    Ok(commits)
}

#[tauri::command]
pub fn get_repo_info(repo_path: String) -> Result<RepoInfo, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let name = std::path::Path::new(&repo_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| repo_path.clone());

    // Current branch
    let current_branch = repo.head()
        .ok()
        .and_then(|h| h.shorthand().ok().map(|s| s.to_string()))
        .unwrap_or_else(|| "HEAD (detached)".to_string());

    // Is dirty?
    let statuses = repo.statuses(None);
    let is_dirty = statuses.map_or(false, |s| !s.is_empty());

    // Branch list
    let mut branches = Vec::new();
    if let Ok(branch_iter) = repo.branches(Some(git2::BranchType::Local)) {
        for branch in branch_iter.flatten() {
            if let Ok(name) = branch.0.name() {
                if let Some(n) = name {
                    branches.push(n.to_string());
                }
            }
        }
    }

    // Count commits (quick estimate — count HEAD walk)
    let total_commits = repo.revwalk()
        .and_then(|mut rw| {
            rw.push_head()?;
            Ok(rw.count())
        })
        .unwrap_or(0);

    let upstream_set = super::branch_tracking::branch_is_published(&repo, &current_branch);
    let (ahead, behind) = compute_ahead_behind(&repo, &current_branch).unwrap_or((0, 0));

    Ok(RepoInfo {
        path: repo_path,
        name,
        current_branch,
        is_dirty,
        ahead,
        behind,
        upstream_set,
        total_commits,
        branches,
    })
}

fn compute_ahead_behind(repo: &Repository, branch_name: &str) -> Result<(usize, usize), git2::Error> {
    let head = repo.head()?;
    let local_oid = head.target().ok_or_else(|| git2::Error::from_str("HEAD has no target"))?;

    if let Ok(branch) = repo.find_branch(branch_name, git2::BranchType::Local) {
        if let Ok(upstream) = branch.upstream() {
            if let Some(upstream_oid) = upstream.get().target() {
                return repo.graph_ahead_behind(local_oid, upstream_oid);
            }
        }
    }

    let remote_ref = format!("refs/remotes/origin/{branch_name}");
    if let Ok(remote_oid) = repo.refname_to_id(&remote_ref) {
        return repo.graph_ahead_behind(local_oid, remote_oid);
    }

    let ahead = count_unpublished_commits(repo, local_oid)?;
    Ok((ahead, 0))
}

fn count_unpublished_commits(repo: &Repository, tip: git2::Oid) -> Result<usize, git2::Error> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL)?;
    revwalk.push(tip)?;

    for default in [
        "refs/remotes/origin/main",
        "refs/remotes/origin/master",
        "refs/heads/main",
        "refs/heads/master",
    ] {
        if let Ok(base_oid) = repo.refname_to_id(default) {
            if base_oid != tip {
                if let Ok(base) = repo.merge_base(tip, base_oid) {
                    revwalk.hide(base)?;
                }
            }
            break;
        }
    }

    Ok(revwalk.count())
}
