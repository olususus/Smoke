use std::process::{Command, Stdio};

use crate::auth;
use crate::token_store;

fn percent_encode_token(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn github_auth_base_url(token: &str) -> String {
    format!(
        "https://x-access-token:{}@github.com/",
        percent_encode_token(token)
    )
}

fn apply_github_https_auth(cmd: &mut Command, token: &str) {
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    let base = github_auth_base_url(token);
    let www = format!(
        "https://x-access-token:{}@www.github.com/",
        percent_encode_token(token)
    );
    cmd.args(["-c", "credential.helper="]);
    cmd.arg("-c").arg(format!("url.\"{base}\".insteadOf=https://github.com/"));
    cmd.arg("-c").arg(format!("url.\"{www}\".insteadOf=https://www.github.com/"));
}

/// Git subprocess with GitHub HTTPS auth applied (required for fetch/push).
pub fn git_command(repo_path: &str) -> Result<Command, String> {
    let token = auth::read_stored_token().ok_or_else(|| {
        format!(
            "OAuth sign-in did not leave a readable token (expected at {}). \
             File → Sign out, complete the browser sign-in again, then push. \
             If it still fails, check that path is writable and you have free disk space.",
            token_store::token_backup_path_display()
        )
    })?;
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(repo_path);
    apply_github_https_auth(&mut cmd, &token);
    Ok(cmd)
}

fn push_looks_successful(stdout: &str, stderr: &str) -> bool {
    let combined = format!("{stdout}\n{stderr}");
    let lower = combined.to_lowercase();
    if lower.contains("[rejected]") || lower.contains("error:") || lower.contains("fatal:") {
        return false;
    }
    combined.contains(" -> ")
}

fn friendly_push_error(stderr: &str, stdout: &str) -> String {
    let raw = format_git_stderr(stderr.as_bytes(), stdout.as_bytes());
    let useful: String = raw
        .lines()
        .filter(|line| {
            let t = line.trim();
            !t.starts_with("To https://")
                && !t.starts_with("To http://")
                && !t.starts_with("Enumerating objects")
                && !t.starts_with("Counting objects")
                && !t.starts_with("Compressing objects")
                && !t.starts_with("Writing objects")
                && !t.starts_with("remote: Resolving deltas")
                && !t.is_empty()
        })
        .collect::<Vec<_>>()
        .join("\n");

    let lower = useful.to_lowercase();
    if useful.is_empty() {
        return "Push failed. Sign out and sign in from Smoke, then try again.".to_string();
    }
    if lower.contains("invalid credentials") {
        return format!(
            "{useful}\n\nGitHub rejected the token. Use File → Sign out, then sign in again from the home screen."
        );
    }
    if lower.contains("[rejected]") || lower.contains("remote rejected") {
        if lower.contains("non-fast-forward")
            || lower.contains("fetch first")
            || lower.contains("stale info")
        {
            return format!(
                "{useful}\n\nThe remote branch has commits you don't have yet. Pull first, or force-push if you mean to overwrite the remote."
            );
        }
        if lower.contains("protected") || lower.contains("gh006") || lower.contains("hook declined") {
            return format!(
                "{useful}\n\nThis branch is protected on GitHub. Push a different branch and open a pull request."
            );
        }
        return format!(
            "{useful}\n\nGitHub rejected the push. Check branch protection and write access."
        );
    }
    useful
}

fn format_git_stderr(stderr: &[u8], stdout: &[u8]) -> String {
    let err = String::from_utf8_lossy(stderr).trim().to_string();
    let out = String::from_utf8_lossy(stdout).trim().to_string();
    let msg = if !err.is_empty() { err } else { out };

    let lower = msg.to_lowercase();
    if lower.contains("saml") || lower.contains("sso") || lower.contains("authorize") {
        return format!(
            "{msg}\n\nIf this repo is in a GitHub organization, open github.com/settings/tokens (or the org’s SSO page) and authorize access for Smoke, then try again."
        );
    }
    if lower.contains("invalid credentials")
        || lower.contains("authentication failed")
        || lower.contains("access denied")
        || lower.contains("403")
    {
        return format!(
            "{msg}\n\nSign out of Smoke (File → Sign out) and sign in again. For org repos, authorize SSO at github.com/settings/applications."
        );
    }
    msg
}

pub fn is_tls_unavailable(err: &str) -> bool {
    let e = err.to_lowercase();
    e.contains("no tls")
        || e.contains("tls stream")
        || e.contains("https is not supported")
        || (e.contains("https") && e.contains("not supported"))
        || e.contains("protocol") && e.contains("not supported")
}

pub fn cli_fetch(repo_path: &str) -> Result<(), String> {
    let output = git_command(repo_path)?
        .args(["fetch", "--prune", "origin"])
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;

    if output.status.success() {
        return Ok(());
    }
    Err(format_git_stderr(&output.stderr, &output.stdout))
}

pub fn cli_push(repo_path: &str, branch: &str) -> Result<(), String> {
    cli_push_with_force(repo_path, branch, false)
}

pub fn cli_push_with_force(repo_path: &str, branch: &str, force: bool) -> Result<(), String> {
    let refspec = format!("HEAD:refs/heads/{branch}");
    let mut args = vec!["push", "origin", refspec.as_str()];
    if force {
        args.insert(1, "--force-with-lease");
    }
    run_git_push(repo_path, &args)
}

pub fn cli_push_set_upstream(repo_path: &str, branch: &str, force: bool) -> Result<(), String> {
    let refspec = format!("HEAD:refs/heads/{branch}");
    let mut args = vec!["push", "-u", "origin", refspec.as_str()];
    if force {
        args.insert(1, "--force-with-lease");
    }
    run_git_push(repo_path, &args)
}

pub fn cli_push_tag(repo_path: &str, tag_name: &str) -> Result<(), String> {
    let output = git_command(repo_path)?
        .args(["push", "origin", tag_name])
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;

    if output.status.success() {
        return Ok(());
    }
    Err(format_git_stderr(&output.stderr, &output.stdout))
}

fn run_git_push(repo_path: &str, args: &[&str]) -> Result<(), String> {
    let output = git_command(repo_path)?
        .args(args)
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() || push_looks_successful(&stdout, &stderr) {
        return Ok(());
    }

    Err(friendly_push_error(&stderr, &stdout))
}

pub fn cli_rebase(repo_path: &str, upstream: &str) -> Result<(), String> {
    let output = git_command(repo_path)?
        .args(["rebase", upstream])
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;

    if output.status.success() {
        return Ok(());
    }
    Err(format_git_stderr(&output.stderr, &output.stdout))
}

pub fn cli_rebase_abort(repo_path: &str) -> Result<(), String> {
    let output = git_command(repo_path)?
        .args(["rebase", "--abort"])
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;

    if output.status.success() {
        return Ok(());
    }
    Err(format_git_stderr(&output.stderr, &output.stdout))
}

pub fn cli_rebase_continue(repo_path: &str) -> Result<(), String> {
    let output = git_command(repo_path)?
        .args(["rebase", "--continue"])
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;

    if output.status.success() {
        return Ok(());
    }
    Err(format_git_stderr(&output.stderr, &output.stdout))
}

pub fn cli_squash_merge(repo_path: &str, branch: &str) -> Result<(), String> {
    let merge_out = git_command(repo_path)?
        .args(["merge", "--squash", branch])
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;

    if !merge_out.status.success() {
        return Err(format_git_stderr(&merge_out.stderr, &merge_out.stdout));
    }

    let commit_out = git_command(repo_path)?
        .args(["commit", "-m", &format!("Squash merge branch '{branch}'")])
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;

    if commit_out.status.success() {
        return Ok(());
    }
    Err(format_git_stderr(&commit_out.stderr, &commit_out.stdout))
}

pub fn cli_apply_cached(repo_path: &str, patch: &str) -> Result<(), String> {
    use std::io::Write;

    let mut child = git_command(repo_path)?
        .args(["apply", "--cached", "--recount", "--unidiff-zero", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not run git apply: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(patch.as_bytes())
            .map_err(|e| format!("Failed to write patch: {e}"))?;
    }

    let output = child.wait_with_output().map_err(|e| format!("{e}"))?;
    if output.status.success() {
        return Ok(());
    }
    Err(format_git_stderr(&output.stderr, &output.stdout))
}

pub fn cli_commit(repo_path: &str, message: &str, sign: bool) -> Result<String, String> {
    use std::io::Write;

    let mut args = vec!["commit"];
    if sign {
        args.push("-S");
    }
    args.push("-F");
    args.push("-");

    let mut child = Command::new("git");
    child.arg("-C").arg(repo_path);
    let mut child = child
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not run git commit: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(message.as_bytes())
            .map_err(|e| format!("Failed to write commit message: {e}"))?;
    }

    let output = child.wait_with_output().map_err(|e| format!("{e}"))?;
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Ok(stdout.trim().to_string());
    }
    Err(format_git_stderr(&output.stderr, &output.stdout))
}

pub fn cli_apply_cached_reverse(repo_path: &str, patch: &str) -> Result<(), String> {
    use std::io::Write;

    let mut child = Command::new("git");
    child.arg("-C").arg(repo_path);
    let mut child = child
        .args(["apply", "--cached", "--reverse", "--recount", "--unidiff-zero", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not run git apply: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(patch.as_bytes())
            .map_err(|e| format!("Failed to write patch: {e}"))?;
    }

    let output = child.wait_with_output().map_err(|e| format!("{e}"))?;
    if output.status.success() {
        return Ok(());
    }
    Err(format_git_stderr(&output.stderr, &output.stdout))
}
