use std::process::Command;

#[tauri::command]
pub fn get_git_config(repo_path: String, key: String) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&repo_path)
        .args(["config", "--get", &key])
        .output()
        .map_err(|e| format!("Could not run git config: {e}"))?;

    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if value.is_empty() {
            return Ok(None);
        }
        return Ok(Some(value));
    }

    Ok(None)
}

#[tauri::command]
pub fn open_repo_in_terminal(repo_path: String) -> Result<(), String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());

    let terminals: &[(&str, Vec<String>)] = &[
        (
            "xdg-terminal-exec",
            vec![
                "--dir".into(),
                repo_path.clone(),
                shell.clone(),
            ],
        ),
        (
            "gnome-terminal",
            vec![
                format!("--working-directory={repo_path}"),
                "--".into(),
                shell.clone(),
            ],
        ),
        (
            "konsole",
            vec![
                "--workdir".into(),
                repo_path.clone(),
                "-e".into(),
                shell.clone(),
            ],
        ),
        (
            "xfce4-terminal",
            vec![
                "--working-directory".into(),
                repo_path.clone(),
                "-e".into(),
                shell.clone(),
            ],
        ),
        (
            "kitty",
            vec![
                "--directory".into(),
                repo_path.clone(),
                shell.clone(),
            ],
        ),
        (
            "alacritty",
            vec![
                "--working-directory".into(),
                repo_path.clone(),
                "-e".into(),
                shell.clone(),
            ],
        ),
    ];

    for (program, args) in terminals {
        if Command::new("which")
            .arg(program)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            let status = Command::new(program).args(args).spawn();
            if status.is_ok() {
                return Ok(());
            }
        }
    }

    Err(
        "No supported terminal emulator found. Install gnome-terminal, konsole, kitty, or xdg-terminal-exec."
            .into(),
    )
}

#[tauri::command]
pub fn open_in_external_editor(repo_path: String, editor_command: String) -> Result<(), String> {
    let editor_command = editor_command.trim();
    if editor_command.is_empty() {
        return Err("Set an external editor in App settings first.".into());
    }

    let parts: Vec<&str> = editor_command.split_whitespace().collect();
    let program = parts.first().ok_or("Invalid editor command")?;

    let mut cmd = Command::new(program);
    cmd.current_dir(&repo_path);
    for arg in parts.iter().skip(1) {
        cmd.arg(arg);
    }
    cmd.arg(".");

    cmd.spawn()
        .map_err(|e| format!("Failed to launch editor: {e}"))?;
    Ok(())
}
