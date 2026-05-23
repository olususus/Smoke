use git2::{FetchOptions, PushOptions, Repository};
use serde::{Deserialize, Serialize};

use super::branch_tracking;
use super::cli_sync::{self, is_tls_unavailable};
use super::credentials::apply_credentials;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub ok: bool,
    pub message: String,
    pub conflict_paths: Vec<String>,
}

fn default_remote<'a>(repo: &'a Repository) -> Result<git2::Remote<'a>, String> {
    if let Ok(remote) = repo.find_remote("origin") {
        return Ok(remote);
    }
    let names = repo.remotes().map_err(|e| format!("{}", e))?;
    for name in names.iter() {
        let Ok(Some(name)) = name else {
            continue;
        };
        if let Ok(remote) = repo.find_remote(name) {
            return Ok(remote);
        }
    }
    Err("No remote configured".to_string())
}

fn upstream_branch(repo: &Repository) -> Result<String, String> {
    let head = repo
        .head()
        .map_err(|e| format!("No current branch: {}", e))?;
    let branch_name = head
        .shorthand()
        .map_err(|_| "Detached HEAD — checkout a branch first.".to_string())?
        .to_string();

    match repo.branch_upstream_name(&branch_name) {
        Ok(up) => Ok(String::from_utf8_lossy(&up).into_owned()),
        Err(_) => Ok(format!("origin/{branch_name}")),
    }
}

fn remote_tracking_ref(upstream: &str) -> String {
    if upstream.starts_with("refs/") {
        upstream.to_string()
    } else {
        format!("refs/remotes/{upstream}")
    }
}

fn annotated_from_ref<'a>(repo: &'a Repository, refname: &str) -> Result<git2::AnnotatedCommit<'a>, String> {
    let oid = repo
        .refname_to_id(refname)
        .map_err(|e| format!("Reference not found ({refname}): {}", e))?;
    repo.find_annotated_commit(oid)
        .map_err(|e| format!("{}", e))
}

pub fn list_conflict_paths(repo: &Repository) -> Result<Vec<String>, String> {
    let index = repo.index().map_err(|e| format!("{}", e))?;
    if !index.has_conflicts() {
        return Ok(vec![]);
    }

    let mut paths = Vec::new();
    for conflict in index.conflicts().map_err(|e| format!("{}", e))? {
        let c = conflict.map_err(|e| format!("{}", e))?;
        if let Some(our) = c.our {
            if !our.path.is_empty() {
                paths.push(String::from_utf8_lossy(&our.path).into_owned());
            }
        } else if let Some(their) = c.their {
            if !their.path.is_empty() {
                paths.push(String::from_utf8_lossy(&their.path).into_owned());
            }
        }
    }
    paths.sort();
    paths.dedup();
    Ok(paths)
}

pub fn finalize_merge_commit(repo: &Repository) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| format!("{}", e))?;
    let tree_oid = index.write_tree().map_err(|e| format!("{}", e))?;
    let tree = repo.find_tree(tree_oid).map_err(|e| format!("{}", e))?;
    let sig = repo.signature().map_err(|e| format!("{}", e))?;

    let head_commit = repo
        .head()
        .map_err(|e| format!("{}", e))?
        .peel_to_commit()
        .map_err(|e| format!("{}", e))?;

    let mut parents: Vec<git2::Commit> = vec![head_commit];
    if let Ok(merge_head) = repo.find_reference("MERGE_HEAD") {
        if let Ok(mc) = merge_head.peel_to_commit() {
            parents.push(mc);
        }
    }

    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        "Merge",
        &tree,
        &parent_refs,
    )
    .map_err(|e| format!("Failed to create merge commit: {}", e))?;
    repo.cleanup_state().ok();
    Ok(())
}

fn fetch_libgit2(repo_path: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| format!("{}", e))?;
    let mut remote = default_remote(&repo)?;
    let mut opts = FetchOptions::new();
    let mut callbacks = git2::RemoteCallbacks::new();
    apply_credentials(&mut callbacks);
    opts.remote_callbacks(callbacks);

    remote
        .fetch(&[] as &[&str], Some(&mut opts), None)
        .map_err(|e| format!("{}", e))?;

    repo.cleanup_state().ok();
    Ok(())
}

#[tauri::command]
pub fn fetch_remote(repo_path: String) -> Result<SyncResult, String> {
    // Try CLI fetch first (uses stored OAuth token, same path as push).
    // Fall back to libgit2 for SSH remotes or when git is not in PATH.
    if let Err(cli_err) = cli_sync::cli_fetch(&repo_path) {
        if fetch_libgit2(&repo_path).is_err() {
            return Err(format!("Fetch failed: {cli_err}"));
        }
    }

    Ok(SyncResult {
        ok: true,
        message: "Fetched from remote.".to_string(),
        conflict_paths: vec![],
    })
}

#[tauri::command]
pub fn pull_remote(repo_path: String) -> Result<SyncResult, String> {
    fetch_remote(repo_path.clone())?;

    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let upstream = upstream_branch(&repo)?;
    let tracking = remote_tracking_ref(&upstream);
    let annotated = annotated_from_ref(&repo, &tracking)?;

    let (analysis, _) = repo
        .merge_analysis(&[&annotated])
        .map_err(|e| format!("{}", e))?;

    if analysis.is_up_to_date() {
        return Ok(SyncResult {
            ok: true,
            message: "Already up to date.".to_string(),
            conflict_paths: vec![],
        });
    }

    let branch_name = repo
        .head()
        .map_err(|e| format!("{}", e))?
        .shorthand()
        .map_err(|_| "Detached HEAD".to_string())?
        .to_string();

    if analysis.is_fast_forward() {
        let upstream_oid = repo
            .refname_to_id(&tracking)
            .map_err(|e| format!("{}", e))?;
        let branch_ref = format!("refs/heads/{branch_name}");
        repo.reference(&branch_ref, upstream_oid, true, "pull")
            .map_err(|e| format!("{}", e))?;
        repo.set_head(&branch_ref).map_err(|e| format!("{}", e))?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .map_err(|e| format!("{}", e))?;
        return Ok(SyncResult {
            ok: true,
            message: "Fast-forwarded to latest.".to_string(),
            conflict_paths: vec![],
        });
    }

    let mut merge_opts = git2::MergeOptions::new();
    repo.merge(&[&annotated], Some(&mut merge_opts), None)
        .map_err(|e| format!("Merge failed: {}", e))?;

    let conflict_paths = list_conflict_paths(&repo)?;

    if conflict_paths.is_empty() && !repo.index().map_err(|e| format!("{}", e))?.has_conflicts() {
        finalize_merge_commit(&repo)?;
        Ok(SyncResult {
            ok: true,
            message: "Merged successfully.".to_string(),
            conflict_paths: vec![],
        })
    } else {
        Ok(SyncResult {
            ok: false,
            message: format!(
                "Merge stopped with {} conflict(s). Resolve them in Changes.",
                conflict_paths.len()
            ),
            conflict_paths,
        })
    }
}

#[tauri::command]
pub fn check_push_requires_force(repo_path: String) -> Result<bool, String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let head = repo.head().map_err(|e| format!("{}", e))?;
    let branch = head
        .shorthand()
        .map_err(|_| "Detached HEAD".to_string())?;

    let tracking = if let Ok(up) = repo.branch_upstream_name(branch) {
        remote_tracking_ref(&String::from_utf8_lossy(&up))
    } else {
        format!("refs/remotes/origin/{branch}")
    };

    let local_oid = head.target().ok_or("Invalid HEAD")?;
    let remote_oid = match repo.refname_to_id(&tracking) {
        Ok(oid) => oid,
        Err(_) => return Ok(false),
    };

    if local_oid == remote_oid {
        return Ok(false);
    }

    let merge_base = repo
        .merge_base(local_oid, remote_oid)
        .map_err(|e| format!("{}", e))?;

    Ok(merge_base != remote_oid)
}

fn push_libgit2(repo_path: &str, branch: &str, set_upstream: bool, force: bool) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| format!("{}", e))?;
    let mut remote = default_remote(&repo)?;

    let prefix = if force { "+" } else { "" };
    let refspec = format!("{prefix}refs/heads/{branch}:refs/heads/{branch}");

    let mut callbacks = git2::RemoteCallbacks::new();
    apply_credentials(&mut callbacks);

    let rejected = std::sync::Arc::new(std::sync::Mutex::new(None::<String>));
    let rejected_clone = rejected.clone();
    callbacks.push_update_reference(move |_refname, status| {
        if let Some(msg) = status {
            if let Ok(mut guard) = rejected_clone.lock() {
                *guard = Some(msg.to_string());
            }
        }
        Ok(())
    });

    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    remote
        .push(&[refspec.as_str()], Some(&mut push_opts))
        .map_err(|e| format!("{}", e))?;

    if let Some(msg) = rejected.lock().ok().and_then(|g| g.clone()) {
        return Err(format!("Push rejected by remote: {msg}"));
    }

    if set_upstream {
        let mut config = repo.config().map_err(|e| format!("{}", e))?;
        config
            .set_str(&format!("branch.{branch}.remote"), "origin")
            .map_err(|e| format!("{}", e))?;
        config
            .set_str(&format!("branch.{branch}.merge"), &format!("refs/heads/{branch}"))
            .map_err(|e| format!("{}", e))?;
    }

    Ok(())
}

fn do_push(repo_path: &str, branch: &str, publishing: bool, force: bool) -> Result<(), String> {
    let cli_result = if publishing {
        cli_sync::cli_push_set_upstream(repo_path, branch, force)
    } else if force {
        cli_sync::cli_push_with_force(repo_path, branch, true)
    } else {
        cli_sync::cli_push(repo_path, branch)
    };

    match cli_result {
        Ok(()) => Ok(()),
        Err(e) if is_tls_unavailable(&e) => {
            push_libgit2(repo_path, branch, publishing, force)
                .map_err(|lib_err| format!("Push failed: {lib_err}"))
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn push_remote(repo_path: String, force: Option<bool>) -> Result<SyncResult, String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;

    let head = repo.head().map_err(|e| format!("{}", e))?;
    let branch = head
        .shorthand()
        .map_err(|_| "Cannot push from detached HEAD.".to_string())?;

    let use_force = force.unwrap_or(false);
    let had_upstream = branch_tracking::branch_upstream_configured(&repo, branch);
    let publishing = !had_upstream;

    let _ = cli_sync::cli_fetch(&repo_path);

    do_push(&repo_path, branch, publishing, use_force)?;

    let _ = cli_sync::cli_fetch(&repo_path);

    let message = if publishing {
        format!("Published branch {branch} to origin.")
    } else {
        format!("Pushed {branch} to remote.")
    };

    Ok(SyncResult {
        ok: true,
        message,
        conflict_paths: vec![],
    })
}

#[tauri::command]
pub fn merge_branch(repo_path: String, branch_name: String) -> Result<SyncResult, String> {
    let repo = Repository::open(&repo_path).map_err(|e| format!("{}", e))?;
    let refname = format!("refs/heads/{branch_name}");
    let annotated = annotated_from_ref(&repo, &refname)?;

    let (analysis, _) = repo
        .merge_analysis(&[&annotated])
        .map_err(|e| format!("{}", e))?;

    if analysis.is_up_to_date() {
        return Ok(SyncResult {
            ok: true,
            message: "Nothing to merge.".to_string(),
            conflict_paths: vec![],
        });
    }

    let mut merge_opts = git2::MergeOptions::new();
    repo.merge(&[&annotated], Some(&mut merge_opts), None)
        .map_err(|e| format!("Merge failed: {}", e))?;

    let conflict_paths = list_conflict_paths(&repo)?;

    if conflict_paths.is_empty() && !repo.index().map_err(|e| format!("{}", e))?.has_conflicts() {
        finalize_merge_commit(&repo)?;
        Ok(SyncResult {
            ok: true,
            message: format!("Merged {branch_name}."),
            conflict_paths: vec![],
        })
    } else {
        Ok(SyncResult {
            ok: false,
            message: format!(
                "Merge of {branch_name} has {} conflict(s).",
                conflict_paths.len()
            ),
            conflict_paths,
        })
    }
}
