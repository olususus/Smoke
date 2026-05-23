mod auth;
mod git;
mod identity;
mod glib_quiet;
mod webkit_linux;
mod path_safety;
mod paths;
mod secrets;
mod token_store;

use auth::AuthSession;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    webkit_linux::apply();
    glib_quiet::suppress_gfileinfo_size_spam();

    tauri::Builder::default()
        .manage(AuthSession::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            auth::warm_token_cache();
            #[cfg(target_os = "linux")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("Smoke");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::auth_request_device_code,
            auth::auth_poll_token,
            auth::auth_check_stored,
            auth::auth_sign_out,
            auth::auth_login_with_token,
            auth::auth_open_device_page,
            auth::github_api_fetch,
            auth::github_api_request,
            git::history::get_history,
            git::history::get_repo_info,
            git::diff::get_commit_diff,
            git::diff::get_working_diff,
            git::diff::get_staged_diff,
            git::diff::get_branch_diff,
            git::staging::get_status,
            git::staging::stage_file,
            git::staging::unstage_file,
            git::staging::stage_all,
            git::staging::unstage_all,
            git::staging::create_commit,
            git::config::get_git_config,
            git::config::open_repo_in_terminal,
            git::config::open_in_external_editor,
            git::staging::discard_file_changes,
            git::staging::discard_all_changes,
            git::staging::stage_hunk,
            git::staging::unstage_hunk,
            git::stash::stash_save,
            git::stash::stash_pop,
            git::stash::stash_apply,
            git::stash::stash_list,
            git::stash::stash_drop,
            git::stash::get_stash_diff,
            git::history_actions::amend_commit,
            git::history_actions::revert_commit,
            git::history_actions::cherry_pick_commit,
            git::sync::fetch_remote,
            git::sync::pull_remote,
            git::sync::push_remote,
            git::sync::check_push_requires_force,
            git::sync::merge_branch,
            git::rebase::rebase_onto,
            git::rebase::rebase_abort,
            git::rebase::rebase_continue,
            git::rebase::squash_merge_branch,
            git::conflicts::get_conflict_detail,
            git::conflicts::resolve_conflict,
            git::conflicts::abort_merge,
            git::branches::get_branches,
            git::branches::checkout_branch,
            git::branches::create_branch,
            git::branches::delete_branch,
            git::branches::rename_branch,
            git::remote::get_remotes,
            git::remote::clone_repo,
            git::remote::init_repo,
            git::bootstrap::write_repo_file,
            git::bootstrap::repo_has_commits,
            git::bootstrap::path_is_empty_dir,
            git::remote::is_git_repo,
            git::remote::open_repo_folder,
            git::remote::add_remote,
            git::remote::remove_remote,
            git::remote::set_remote_url,
            git::remote::rename_remote,
            git::tags::list_tags,
            git::tags::create_tag,
            git::tags::push_tag,
            git::tags::delete_tag,
            identity::get_profiles,
            identity::save_profile,
            identity::delete_profile,
            identity::switch_profile,
            identity::clear_active_profile,
            identity::get_active_profile_id,
            paths::get_log_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Smoke");
}
