use tauri::Manager;

#[tauri::command]
pub fn get_log_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_log_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| format!("{}", e))
}
