use crate::token_store;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PollResult {
    pub status: String,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub retry_after_secs: Option<u64>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PublicAuth {
    pub username: String,
    pub avatar_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub has_token: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct AuthMetadata {
    pub username: String,
    pub avatar_url: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Default)]
struct PendingDeviceAuth {
    device_code: Option<String>,
    user_code: Option<String>,
    verification_uri: Option<String>,
    poll_interval_secs: u64,
}

pub struct AuthSession {
    pending: Mutex<PendingDeviceAuth>,
}

impl Default for AuthSession {
    fn default() -> Self {
        Self {
            pending: Mutex::new(PendingDeviceAuth {
                poll_interval_secs: 5,
                ..Default::default()
            }),
        }
    }
}

#[derive(Debug, Deserialize)]
struct GitHubDeviceResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    #[serde(default)]
    error_description: Option<String>,
    #[serde(default)]
    interval: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct GitHubUser {
    login: String,
    avatar_url: String,
    #[serde(default)]
    name: Option<String>,
}

fn config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("~/.config"));
    base.join("smoke")
}

fn auth_metadata_file() -> PathBuf {
    config_dir().join("auth.json")
}

static TOKEN_MEMORY: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn token_memory() -> &'static Mutex<Option<String>> {
    TOKEN_MEMORY.get_or_init(|| Mutex::new(None))
}

pub fn cache_token(token: &str) {
    if let Ok(mut guard) = token_memory().lock() {
        *guard = Some(token.to_string());
    }
}

pub fn clear_token_cache() {
    if let Ok(mut guard) = token_memory().lock() {
        *guard = None;
    }
}

/// Load token from memory, then disk backup.
pub fn read_stored_token() -> Option<String> {
    if let Ok(guard) = token_memory().lock() {
        if let Some(token) = guard.as_ref() {
            if !token.is_empty() {
                return Some(token.clone());
            }
        }
    }

    let disk = token_store::read_token();
    if let Some(ref token) = disk {
        cache_token(token);
    }
    disk
}

pub fn warm_token_cache() {
    let _ = read_stored_token();
}

fn write_metadata_file(meta: &AuthMetadata) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;

    let json =
        serde_json::to_string_pretty(meta).map_err(|e| format!("Failed to serialize auth: {e}"))?;

    let path = auth_metadata_file();
    fs::write(&path, json).map_err(|e| format!("Failed to write auth file: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("Failed to set auth file permissions: {e}"))?;
    }
    Ok(())
}

fn load_metadata() -> Option<AuthMetadata> {
    let content = fs::read_to_string(auth_metadata_file()).ok()?;
    let meta: AuthMetadata = serde_json::from_str(&content).ok()?;
    if meta.username.is_empty() {
        return None;
    }
    Some(meta)
}

fn save_session(token: &str, user: &GitHubUser) -> Result<PublicAuth, String> {
    token_store::store_token(token)?;
    cache_token(token);

    if read_stored_token().is_none() {
        return Err(format!(
            "GitHub approved sign-in, but Smoke could not read the token back from {}. \
             Check disk space and permissions, then try again.",
            token_store::token_backup_path_display()
        ));
    }

    let meta = AuthMetadata {
        username: user.login.clone(),
        avatar_url: user.avatar_url.clone(),
        name: user.name.clone().filter(|n| !n.is_empty()),
    };
    write_metadata_file(&meta)?;
    Ok(public_auth_from_meta(&meta, true))
}

fn public_auth_from_meta(meta: &AuthMetadata, has_token: bool) -> PublicAuth {
    PublicAuth {
        username: meta.username.clone(),
        avatar_url: meta.avatar_url.clone(),
        name: meta.name.clone(),
        has_token,
    }
}

const CLIENT_ID: &str = match option_env!("GITHUB_CLIENT_ID") {
    Some(id) => id,
    None => "Ov23liDR70dgRpUN7eT8",
};

fn open_system_browser(url: &str) -> Result<(), String> {
    open::that(url)
        .map_err(|e| format!("Could not open browser: {e}\n\nOpen this URL manually:\n{url}"))
}

#[tauri::command]
pub async fn auth_request_device_code(session: State<'_, AuthSession>) -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::new();

    let resp = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .header("User-Agent", "Smoke/0.1.0")
        .form(&[
            ("client_id", CLIENT_ID),
            ("scope", "repo read:org read:user workflow"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to request device code: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub returned {status}: {body}"));
    }

    let data: GitHubDeviceResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse device code response: {e}"))?;

    let interval = data.interval.max(5);

    {
        let mut pending = session.pending.lock().map_err(|e| e.to_string())?;
        pending.device_code = Some(data.device_code.clone());
        pending.user_code = Some(data.user_code.clone());
        pending.verification_uri = Some(data.verification_uri.clone());
        pending.poll_interval_secs = interval;
    }

    Ok(DeviceCodeResponse {
        device_code: data.device_code,
        user_code: data.user_code,
        verification_uri: data.verification_uri,
        expires_in: data.expires_in,
        interval,
    })
}

#[tauri::command]
pub async fn auth_poll_token(session: State<'_, AuthSession>) -> Result<PollResult, String> {
    let (device_code, poll_interval) = {
        let pending = session.pending.lock().map_err(|e| e.to_string())?;
        let code = pending
            .device_code
            .clone()
            .ok_or_else(|| "No active sign-in session. Click Sign in again.".to_string())?;
        (code, pending.poll_interval_secs)
    };

    let client = reqwest::Client::new();

    let resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .header("User-Agent", "Smoke/0.1.0")
        .form(&[
            ("client_id", CLIENT_ID),
            ("device_code", device_code.as_str()),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to poll token: {e}"))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read token response: {e}"))?;

    let data: GitHubTokenResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse token response ({status}): {e}"))?;

    if let Some(token) = data.access_token {
        let user = fetch_user_info(&token).await?;
        save_session(&token, &user)?;

        {
            let mut pending = session.pending.lock().map_err(|e| e.to_string())?;
            pending.device_code = None;
        }

        return Ok(PollResult {
            status: "success".to_string(),
            username: Some(user.login),
            avatar_url: Some(user.avatar_url),
            retry_after_secs: None,
            message: Some("Signed in successfully.".to_string()),
        });
    }

    if let Some(err) = data.error {
        let retry = data.interval.or(Some(poll_interval.max(5)));
        return match err.as_str() {
            "authorization_pending" => Ok(PollResult {
                status: "pending".to_string(),
                username: None,
                avatar_url: None,
                retry_after_secs: None,
                message: Some("Waiting for you to approve in the browser…".to_string()),
            }),
            "slow_down" => Ok(PollResult {
                status: "slow_down".to_string(),
                username: None,
                avatar_url: None,
                retry_after_secs: retry,
                message: Some("GitHub asked to slow down polling…".to_string()),
            }),
            "expired_token" => {
                let mut pending = session.pending.lock().map_err(|e| e.to_string())?;
                pending.device_code = None;
                Ok(PollResult {
                    status: "expired".to_string(),
                    username: None,
                    avatar_url: None,
                    retry_after_secs: None,
                    message: Some("Device code expired. Sign in again.".to_string()),
                })
            }
            "access_denied" => Err("Access was denied on GitHub.".to_string()),
            _ => Err(format!(
                "GitHub OAuth error: {} — {}",
                err,
                data.error_description.unwrap_or_default()
            )),
        };
    }

    Ok(PollResult {
        status: "pending".to_string(),
        username: None,
        avatar_url: None,
        retry_after_secs: None,
        message: Some("Waiting for authorization…".to_string()),
    })
}

#[tauri::command]
pub async fn auth_check_stored() -> Result<Option<PublicAuth>, String> {
    let Some(meta) = load_metadata() else {
        return Ok(None);
    };

    let Some(token) = read_stored_token() else {
        return Ok(Some(public_auth_from_meta(&meta, false)));
    };

    match validate_token(&token).await {
        Ok(true) => Ok(Some(public_auth_from_meta(&meta, true))),
        Ok(false) => {
            let _ = auth_sign_out_internal();
            Ok(None)
        }
        Err(_) => Ok(Some(public_auth_from_meta(&meta, true))),
    }
}

fn auth_sign_out_internal() -> Result<(), String> {
    clear_token_cache();
    let _ = token_store::delete_token();
    let path = auth_metadata_file();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to remove auth file: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn auth_sign_out(session: State<'_, AuthSession>) -> Result<(), String> {
    if let Ok(mut pending) = session.pending.lock() {
        *pending = PendingDeviceAuth::default();
    }
    auth_sign_out_internal()
}

#[tauri::command]
pub async fn auth_open_device_page(session: State<'_, AuthSession>) -> Result<String, String> {
    let (verification_uri, user_code) = {
        let pending = session.pending.lock().map_err(|e| e.to_string())?;
        let uri = pending
            .verification_uri
            .clone()
            .ok_or_else(|| "No active sign-in session.".to_string())?;
        let code = pending
            .user_code
            .clone()
            .ok_or_else(|| "No user code in session.".to_string())?;
        (uri, code)
    };

    let base = verification_uri.trim_end_matches('/');
    let url = format!("{base}?user_code={user_code}");
    open_system_browser(&url)?;
    Ok(url)
}

#[tauri::command]
pub async fn auth_login_with_token(token: String) -> Result<PublicAuth, String> {
    let user = fetch_user_info(&token).await?;
    save_session(&token, &user)
}

fn is_allowed_github_api_path(path: &str) -> bool {
    if !path.starts_with('/') || path.contains("..") {
        return false;
    }
    path.starts_with("/user")
        || path.starts_with("/users/")
        || path.starts_with("/repos/")
        || path.starts_with("/repositories/")
        || path.starts_with("/search/")
        || path.starts_with("/gitignore/")
        || path.starts_with("/licenses/")
}

fn is_post_create_repo(path: &str) -> bool {
    if path == "/user/repos" {
        return true;
    }
    let parts: Vec<&str> = path.trim_matches('/').split('/').collect();
    parts.len() == 3 && parts[0] == "orgs" && parts[2] == "repos" && !parts[1].is_empty()
}

fn is_allowed_write_method(method: &str, path: &str) -> bool {
    let m = method.to_uppercase();
    if m == "GET" {
        return true;
    }
    if m != "POST" && m != "PUT" && m != "PATCH" {
        return false;
    }
    if m == "POST" && is_post_create_repo(path) {
        return true;
    }
    path.contains("/pulls")
        || path.contains("/issues")
        || path.contains("/merges")
        || path.ends_with("/reviews")
}

fn format_github_api_error(status: u16, body: &str) -> String {
    let mut message = body.trim().to_string();
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(msg) = json.get("message").and_then(|m| m.as_str()) {
            message = msg.to_string();
        }
    }

    let lower = message.to_lowercase();
    let mut hint = String::new();

    if status == 403 {
        if lower.contains("rate limit") || lower.contains("rate_limit") {
            hint = "\n\nGitHub API rate limit exceeded. Wait a minute and try again.".to_string();
        } else if lower.contains("saml") || lower.contains("sso") {
            hint = "\n\nThis organization requires SSO: open github.com/settings/tokens, authorize Smoke for the org, then sign in again.".to_string();
        } else if lower.contains("resource not accessible") || lower.contains("permission") {
            hint = "\n\nYour token may lack access to this repository. Sign out and sign in again (device flow requests repo scope), or use a PAT with repo scope.".to_string();
        } else {
            hint = "\n\nForbidden — verify you can access this repo on github.com and that your token has repo scope (re-sign in from Smoke if needed).".to_string();
        }
    } else if status == 401 {
        hint = "\n\nSign in again from File → Sign out, then sign in.".to_string();
    }

    if message.is_empty() {
        format!("GitHub API returned {status}.{hint}")
    } else {
        format!("GitHub API returned {status}: {message}{hint}")
    }
}

async fn github_api_call(
    method: &str,
    api_path: &str,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let path = api_path.trim().to_string();
    if !is_allowed_github_api_path(&path) {
        return Err("API path not allowed".to_string());
    }
    if !is_allowed_write_method(method, &path) {
        return Err(format!("HTTP method {method} not allowed for this path"));
    }

    let token = read_stored_token().ok_or_else(|| "Not signed in".to_string())?;
    let client = reqwest::Client::new();
    let url = format!("https://api.github.com{path}");

    let mut req = client
        .request(
            method
                .parse()
                .map_err(|_| format!("Invalid HTTP method: {method}"))?,
            &url,
        )
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "Smoke/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28");

    if let Some(b) = body {
        req = req.json(&b);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {e}"))?;

    let status = resp.status();
    if status == reqwest::StatusCode::NO_CONTENT {
        return Ok(serde_json::json!({}));
    }

    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format_github_api_error(status.as_u16(), &text));
    }

    let text = resp.text().await.unwrap_or_default();
    if text.trim().is_empty() {
        return Ok(serde_json::json!({}));
    }

    serde_json::from_str(&text).map_err(|e| format!("Failed to parse GitHub API response: {e}"))
}

#[tauri::command]
pub async fn github_api_fetch(api_path: String) -> Result<serde_json::Value, String> {
    github_api_call("GET", &api_path, None).await
}

#[derive(serde::Deserialize)]
pub struct GithubApiRequest {
    pub method: String,
    pub api_path: String,
    pub body: Option<serde_json::Value>,
}

#[tauri::command]
pub async fn github_api_request(req: GithubApiRequest) -> Result<serde_json::Value, String> {
    github_api_call(&req.method, &req.api_path, req.body).await
}

async fn fetch_user_info(token: &str) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();

    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "Smoke/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch user info: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub user API returned {}", resp.status()));
    }

    resp.json::<GitHubUser>()
        .await
        .map_err(|e| format!("Failed to parse user info: {e}"))
}

async fn validate_token(token: &str) -> Result<bool, String> {
    let client = reqwest::Client::new();

    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "Smoke/0.1.0")
        .send()
        .await
        .map_err(|e| format!("Token validation failed: {e}"))?;

    Ok(resp.status().is_success())
}
