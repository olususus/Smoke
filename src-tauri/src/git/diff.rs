use git2::{Diff, DiffOptions, Repository};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffLine {
    pub origin: String,      // "+", "-", " " (context)
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub is_secret: bool,     // Flagged by secret scanner
    pub secret_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub new_start: u32,
    pub old_lines: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffFile {
    pub path: String,
    pub status: String,        // "added", "deleted", "modified", "renamed"
    pub hunks: Vec<DiffHunk>,
    pub additions: usize,
    pub deletions: usize,
    pub has_secrets: bool,
    pub binary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffResult {
    pub files: Vec<DiffFile>,
    pub total_additions: usize,
    pub total_deletions: usize,
    pub total_files: usize,
    pub total_secrets: usize,
}

#[tauri::command]
pub fn get_commit_diff(repo_path: String, commit_hash: String) -> Result<DiffResult, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let oid = git2::Oid::from_str(&commit_hash)
        .map_err(|e| format!("Invalid commit hash: {}", e))?;

    let commit = repo.find_commit(oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;

    let tree = commit.tree()
        .map_err(|e| format!("Failed to get commit tree: {}", e))?;

    let parent_tree = if commit.parent_count() > 0 {
        commit.parent(0).ok().and_then(|p| p.tree().ok())
    } else {
        None
    };

    let mut opts = DiffOptions::new();
    opts.context_lines(3);

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))
        .map_err(|e| format!("Failed to generate diff: {}", e))?;

    parse_diff(&diff)
}

#[tauri::command]
pub fn get_working_diff(repo_path: String) -> Result<DiffResult, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut opts = DiffOptions::new();
    opts.context_lines(3);
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);

    let diff = repo.diff_index_to_workdir(None, Some(&mut opts))
        .map_err(|e| format!("Failed to generate working diff: {}", e))?;

    parse_diff(&diff)
}

#[tauri::command]
pub fn get_branch_diff(
    repo_path: String,
    base_branch: String,
    compare_branch: String,
) -> Result<DiffResult, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let base_ref = format!("refs/heads/{base_branch}");
    let compare_ref = if compare_branch == "HEAD" || compare_branch.is_empty() {
        repo.head()
            .map_err(|e| format!("No HEAD: {}", e))?
            .name()
            .map_err(|e| format!("Invalid HEAD: {}", e))?
            .to_string()
    } else {
        format!("refs/heads/{compare_branch}")
    };

    let base_tree = repo
        .find_reference(&base_ref)
        .or_else(|_| repo.find_reference(&format!("refs/remotes/origin/{base_branch}")))
        .map_err(|e| format!("Branch '{base_branch}' not found: {}", e))?
        .peel_to_tree()
        .map_err(|e| format!("{}", e))?;

    let compare_tree = repo
        .find_reference(&compare_ref)
        .or_else(|_| repo.find_reference(&format!("refs/remotes/origin/{compare_branch}")))
        .map_err(|e| format!("Branch '{compare_branch}' not found: {}", e))?
        .peel_to_tree()
        .map_err(|e| format!("{}", e))?;

    let mut opts = DiffOptions::new();
    opts.context_lines(3);

    let diff = repo
        .diff_tree_to_tree(Some(&base_tree), Some(&compare_tree), Some(&mut opts))
        .map_err(|e| format!("Failed to generate branch diff: {}", e))?;

    parse_diff(&diff)
}

#[tauri::command]
pub fn get_staged_diff(repo_path: String) -> Result<DiffResult, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let head_tree = repo.head()
        .and_then(|h| h.peel_to_tree())
        .ok();

    let mut opts = DiffOptions::new();
    opts.context_lines(3);

    let diff = repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
        .map_err(|e| format!("Failed to generate staged diff: {}", e))?;

    parse_diff(&diff)
}

// --- Internal helpers ---

fn parse_diff(diff: &Diff) -> Result<DiffResult, String> {
    let mut files: Vec<DiffFile> = Vec::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;
    let mut total_secrets = 0;

    let secret_patterns = super::super::secrets::get_patterns();

    for delta_idx in 0..diff.deltas().len() {
        let delta = diff.get_delta(delta_idx).unwrap();

        let path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            git2::Delta::Copied => "copied",
            _ => "modified",
        }.to_string();

        let binary = delta.new_file().is_binary() || delta.old_file().is_binary();

        let mut hunks: Vec<DiffHunk> = Vec::new();
        let mut file_additions = 0;
        let mut file_deletions = 0;
        let mut file_has_secrets = false;

        if !binary {
            if let Ok(patch) = git2::Patch::from_diff(diff, delta_idx) {
                if let Some(patch) = patch {
                    for hunk_idx in 0..patch.num_hunks() {
                        let (hunk, _) = patch.hunk(hunk_idx)
                            .map_err(|e| format!("Failed to get hunk: {}", e))?;

                        let header = std::str::from_utf8(hunk.header())
                            .unwrap_or("")
                            .trim()
                            .to_string();

                        let mut lines: Vec<DiffLine> = Vec::new();

                        let num_lines = patch.num_lines_in_hunk(hunk_idx)
                            .map_err(|e| format!("Failed to count hunk lines: {}", e))?;

                        for line_idx in 0..num_lines {
                            let line = patch.line_in_hunk(hunk_idx, line_idx)
                                .map_err(|e| format!("Failed to get line: {}", e))?;

                            let content = std::str::from_utf8(line.content())
                                .unwrap_or("")
                                .to_string();

                            let origin = match line.origin() {
                                '+' => {
                                    file_additions += 1;
                                    "+".to_string()
                                }
                                '-' => {
                                    file_deletions += 1;
                                    "-".to_string()
                                }
                                _ => " ".to_string(),
                            };

                            // Scan for secrets
                            let (is_secret, secret_type) = scan_line_for_secrets(&content, &secret_patterns);
                            if is_secret {
                                file_has_secrets = true;
                                total_secrets += 1;
                            }

                            lines.push(DiffLine {
                                origin,
                                content,
                                old_lineno: line.old_lineno(),
                                new_lineno: line.new_lineno(),
                                is_secret,
                                secret_type,
                            });
                        }

                        hunks.push(DiffHunk {
                            header,
                            old_start: hunk.old_start(),
                            new_start: hunk.new_start(),
                            old_lines: hunk.old_lines(),
                            new_lines: hunk.new_lines(),
                            lines,
                        });
                    }
                }
            }
        }

        total_additions += file_additions;
        total_deletions += file_deletions;

        files.push(DiffFile {
            path,
            status,
            hunks,
            additions: file_additions,
            deletions: file_deletions,
            has_secrets: file_has_secrets,
            binary,
        });
    }

    Ok(DiffResult {
        total_files: files.len(),
        total_additions,
        total_deletions,
        total_secrets,
        files,
    })
}

fn scan_line_for_secrets(content: &str, patterns: &[(regex::Regex, &str)]) -> (bool, Option<String>) {
    for (pattern, name) in patterns {
        if pattern.is_match(content) {
            return (true, Some(name.to_string()));
        }
    }
    (false, None)
}
