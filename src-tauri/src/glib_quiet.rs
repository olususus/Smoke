//! Filters a known-harmless GLib-GIO critical from GTK/WebKit on GLib 2.76+.
//! See: https://gitlab.gnome.org/GNOME/glib/-/merge_requests/3261

#[cfg(target_os = "linux")]
pub fn suppress_gfileinfo_size_spam() {
    use glib::{LogField, LogWriterOutput};

    glib::log_set_writer_func(|level, fields: &[LogField<'_>]| {
        let message = fields
            .iter()
            .find(|f| f.key() == "MESSAGE")
            .and_then(|f| f.value_str());

        if let Some(msg) = message {
            if msg.contains("standard::size") || msg.contains("g_file_info_get_size") {
                return LogWriterOutput::Handled;
            }
        }

        glib::log_writer_default(level, fields)
    });
}

#[cfg(not(target_os = "linux"))]
pub fn suppress_gfileinfo_size_spam() {}
