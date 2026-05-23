use git2::{Cred, CredentialType, RemoteCallbacks};

use crate::auth;

pub fn apply_credentials(callbacks: &mut RemoteCallbacks<'_>) {
    let token = auth::read_stored_token();
    callbacks.credentials(move |_url, username_from_url, allowed| {
        if let Some(ref t) = token {
            if allowed.contains(CredentialType::USER_PASS_PLAINTEXT)
                || allowed.contains(CredentialType::DEFAULT)
            {
                let user = username_from_url.unwrap_or("x-access-token");
                return Cred::userpass_plaintext(user, t);
            }
        }
        if allowed.contains(CredentialType::SSH_KEY) {
            if let Some(home) = dirs::home_dir() {
                let path = home.join(".ssh").join("id_rsa");
                if path.exists() {
                    let user = username_from_url.unwrap_or("git");
                    return Cred::ssh_key(user, None, &path, None);
                }
            }
        }
        Err(git2::Error::from_str(
            "No credentials — sign in to Smoke or configure SSH keys.",
        ))
    });
}
