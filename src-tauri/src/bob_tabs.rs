// File: src-tauri/src/bob_tabs.rs
// Purpose: Real child WebView2 tabs inside the existing Chats window.
// Only the trusted localhost Chats webview can request these operations.
use serde::Deserialize;
use serde_json::Value;
use tauri::{LogicalPosition, LogicalSize, Manager, Webview, WebviewUrl};

#[derive(Deserialize)]
struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn identifier(id: &str) -> bool {
    id.len() == 36 && id.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-')
}

fn chat_url(raw: &str) -> Option<tauri::Url> {
    if raw.len() > 350 { return None }
    let url = tauri::Url::parse(raw).ok()?;
    if url.scheme() != "https" || url.host_str() != Some("chatgpt.com") || url.port().is_some()
        || !url.username().is_empty() || url.password().is_some()
        || url.query().is_some() || url.fragment().is_some() { return None }
    let path = url.path();
    if path == "/" { return Some(url) }
    let parts: Vec<_> = path.trim_matches('/').split('/').collect();
    let valid_part = |v: &str| (8..=100).contains(&v.len())
        && v.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_');
    if (parts.len() == 2 && parts[0] == "c" && valid_part(parts[1])) ||
       (parts.len() == 4 && parts[0] == "g" && parts[2] == "c" &&
        valid_part(parts[1]) && valid_part(parts[3])) {
        Some(url)
    } else { None }
}

fn label(id: &str) -> Result<String, String> {
    if !identifier(id) { return Err("Invalid Bob conversation identifier".into()) }
    Ok(format!("bob-{id}"))
}

fn bounds(value: &Value, width: f64, height: f64) -> Result<(LogicalPosition<f64>, LogicalSize<f64>), String> {
    let rect: Bounds = serde_json::from_value(value.clone()).map_err(|_| "Invalid browser area")?;
    if !rect.x.is_finite() || !rect.y.is_finite() || !rect.width.is_finite() || !rect.height.is_finite()
        || rect.width < 80.0 || rect.height < 80.0 || rect.x < 0.0 || rect.y < 65.0
        || rect.x >= width || rect.y >= height {
        return Err("Browser region outside Chats".into())
    }
    Ok((LogicalPosition::new(rect.x, rect.y),
        LogicalSize::new(rect.width.min(width - rect.x), rect.height.min(height - rect.y))))
}

fn permitted_webview(caller: &Webview) -> bool {
    caller.label() == "chats" && caller.url().is_ok_and(|url|
        url.scheme() == "http" && url.host_str() == Some("127.0.0.1"))
}

fn hide_children(window: &tauri::Window) {
    for view in window.webviews().iter().filter(|view| view.label().starts_with("bob-")) {
        let _ = view.hide();
    }
}

// This is deliberately async. Windows WebView2 can deadlock if add_child is
// called synchronously from an event handler or invoke command.
#[tauri::command]
pub async fn bob_native(
    caller: Webview,
    app: tauri::AppHandle,
    message: Value,
) -> Result<(), String> {
    if !permitted_webview(&caller) { return Err("Untrusted browser cannot control Bob tabs".into()) }
    let op = message.get("type").and_then(Value::as_str).ok_or("Missing browser operation")?;
    let window = app.get_window("chats").ok_or("Chats window is unavailable")?;
    match op {
        "bob-hide" => {
            hide_children(&window);
            Ok(())
        }
        "bob-close" => {
            let id = message.get("id").and_then(Value::as_str).ok_or("Missing tab ID")?;
            if let Some(view) = app.get_webview(&label(id)?) {
                view.close().map_err(|e| e.to_string())?;
            }
            Ok(())
        }
        "bob-select" => {
            let id = message.get("id").and_then(Value::as_str).ok_or("Missing tab ID")?;
            let target_label = label(id)?;
            let tabs = message.get("tabs").and_then(Value::as_array).ok_or("Missing browser tabs")?;
            if tabs.len() > 32 { return Err("Too many browser tabs".into()) }
            let url = tabs.iter().find(|tab| tab.get("id").and_then(Value::as_str) == Some(id))
                .and_then(|tab| tab.get("url").and_then(Value::as_str))
                .and_then(chat_url).ok_or("Invalid ChatGPT conversation URL")?;
            let size = window.inner_size().map_err(|e| e.to_string())?;
            let scale = window.scale_factor().map_err(|e| e.to_string())?;
            let (position, size) = bounds(
                message.get("rect").ok_or("Missing browser region")?,
                size.width as f64 / scale, size.height as f64 / scale,
            )?;

            if app.get_webview(&target_label).is_none() {
                let data_directory = app.path().app_data_dir()
                    .map_err(|e| e.to_string())?.join("bob-chatgpt-webview");
                std::fs::create_dir_all(&data_directory).map_err(|e| e.to_string())?;

                let app_for_page = app.clone();
                let id_for_page = id.to_owned();
                let builder = tauri::webview::WebviewBuilder::new(
                    target_label.clone(), WebviewUrl::External(url),
                )
                .data_directory(data_directory)
                .on_navigation(|url| {
                    // Authentication redirects are HTTPS. Never permit remote
                    // ChatGPT content to navigate into the privileged local UI.
                    url.scheme() == "https" && !matches!(url.host_str(),
                        Some("localhost" | "127.0.0.1"))
                })
                .on_page_load(move |_view, payload| {
                    if !matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) { return }
                    if let Some(url) = chat_url(payload.url().as_str()) {
                        if let Some(chats) = app_for_page.get_webview("chats") {
                            let detail = serde_json::json!({"id": id_for_page, "url": url.as_str()});
                            let script = format!(
                                "window.dispatchEvent(new CustomEvent('bob-webview-url', {{detail: {detail}}}))"
                            );
                            let _ = chats.eval(script);
                        }
                    }
                });
                // The synchronous main-thread call must originate off the UI
                // thread. Tauri marshals add_child onto the right thread.
                let window_for_creation = window.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    window_for_creation.add_child(builder, position, size)
                        .map_err(|error| error.to_string())
                }).await.map_err(|error| error.to_string())??;
            }
            hide_children(&window);
            if let Some(view) = app.get_webview(&target_label) {
                view.set_position(position).map_err(|e| e.to_string())?;
                view.set_size(size).map_err(|e| e.to_string())?;
                view.show().map_err(|e| e.to_string())?;
            }
            Ok(())
        }
        _ => Err("Unsupported browser operation".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::{chat_url, identifier};
    #[test]
    fn validates_browser_urls() {
        assert!(chat_url("https://chatgpt.com/").is_some());
        assert!(chat_url("https://chatgpt.com/c/11111111-1111-4111-8111-111111111111").is_some());
        for url in ["http://chatgpt.com/", "https://evil.example/",
            "https://chatgpt.com.evil.test/", "https://chatgpt.com/?token=x",
            "https://chatgpt.com:444/", "https://chatgpt.com/internal"] {
            assert!(chat_url(url).is_none(), "accepted {url}");
        }
        assert!(identifier("11111111-1111-4111-8111-111111111111"));
        assert!(!identifier("../../../unsafe"));
    }
}
