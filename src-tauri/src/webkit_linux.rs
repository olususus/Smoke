#[cfg(target_os = "linux")]
fn set_default_env(key: &str, value: &str) {
    if std::env::var_os(key).is_none() {
        std::env::set_var(key, value);
    }
}

#[cfg(target_os = "linux")]
fn nvidia_driver_active() -> bool {
    std::path::Path::new("/sys/module/nvidia").exists()
        || std::path::Path::new("/proc/driver/nvidia").exists()
}

#[cfg(target_os = "linux")]
pub fn apply() {
    set_default_env("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    set_default_env("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    set_default_env("GTK_USE_PORTAL", "1");

    if nvidia_driver_active() {
        set_default_env("__NV_DISABLE_EXPLICIT_SYNC", "1");
    }

    let software = std::env::var("SMOKE_WEBKIT_SOFTWARE")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if software {
        set_default_env("LIBGL_ALWAYS_SOFTWARE", "1");
    }
}

#[cfg(not(target_os = "linux"))]
pub fn apply() {}
