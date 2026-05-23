use git2::Repository;

pub fn branch_upstream_configured(repo: &Repository, branch_name: &str) -> bool {
    if branch_name.contains("detached") {
        return false;
    }
    repo.branch_upstream_name(branch_name).is_ok()
}

pub fn branch_exists_on_origin(repo: &Repository, branch_name: &str) -> bool {
    if branch_name.contains("detached") {
        return false;
    }
    let remote_ref = format!("refs/remotes/origin/{branch_name}");
    repo.refname_to_id(&remote_ref).is_ok()
}

/// Branch is on the remote (after fetch) or has explicit upstream tracking configured.
pub fn branch_is_published(repo: &Repository, branch_name: &str) -> bool {
    branch_upstream_configured(repo, branch_name) || branch_exists_on_origin(repo, branch_name)
}
