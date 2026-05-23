use regex::Regex;
use std::sync::LazyLock;

/// Returns compiled regex patterns for detecting secrets in diffs.
/// Each pattern is a tuple of (regex, human-readable name).
pub fn get_patterns() -> &'static Vec<(Regex, &'static str)> {
    static PATTERNS: LazyLock<Vec<(Regex, &'static str)>> = LazyLock::new(|| {
        vec![
            // GitHub tokens
            (Regex::new(r"ghp_[A-Za-z0-9]{36,}").unwrap(), "GitHub Personal Access Token"),
            (Regex::new(r"gho_[A-Za-z0-9]{36,}").unwrap(), "GitHub OAuth Token"),
            (Regex::new(r"ghs_[A-Za-z0-9]{36,}").unwrap(), "GitHub Server Token"),
            (Regex::new(r"ghr_[A-Za-z0-9]{36,}").unwrap(), "GitHub Refresh Token"),
            (Regex::new(r"github_pat_[A-Za-z0-9_]{82,}").unwrap(), "GitHub Fine-Grained PAT"),

            // AWS
            (Regex::new(r"AKIA[0-9A-Z]{16}").unwrap(), "AWS Access Key"),
            (Regex::new(r"aws_secret_access_key\s*=\s*\S+").unwrap(), "AWS Secret Key"),

            // OpenAI / AI providers
            (Regex::new(r"sk-[A-Za-z0-9]{20,}").unwrap(), "API Secret Key (OpenAI/Stripe)"),

            // Generic patterns
            (Regex::new(r#"(?i)(password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{8,}"#).unwrap(), "Password"),
            (Regex::new(r#"(?i)(secret|token|api_key|apikey|access_key)\s*[:=]\s*["']?[^\s"']{8,}"#).unwrap(), "Secret/Token"),
            (Regex::new(r#"(?i)bearer\s+[A-Za-z0-9\-._~+/]+=*"#).unwrap(), "Bearer Token"),

            // Private keys
            (Regex::new(r"-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----").unwrap(), "Private Key"),
            (Regex::new(r"-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----").unwrap(), "SSH Private Key"),

            // Database URLs
            (Regex::new(r#"(?i)(mysql|postgres|postgresql|mongodb|redis)://[^\s"']{10,}"#).unwrap(), "Database URL"),

            // GitLab tokens
            (Regex::new(r"glpat-[A-Za-z0-9\-]{20,}").unwrap(), "GitLab Personal Access Token"),

            // Slack
            (Regex::new(r"xox[bpors]-[A-Za-z0-9\-]{10,}").unwrap(), "Slack Token"),

            // .env variable assignments with sensitive-looking values
            (Regex::new(r#"(?i)(DATABASE_URL|PRIVATE_KEY|SECRET_KEY|ENCRYPTION_KEY)\s*=\s*\S+"#).unwrap(), "Sensitive Env Variable"),
        ]
    });
    &PATTERNS
}
