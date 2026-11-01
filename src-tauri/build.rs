fn main() {
    // Explicitly register Bob's native command with Tauri ACL. The trusted
    // Chats page is a local HTTP service, which Tauri treats as remote content.
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(&["bob_native"]));
    tauri_build::try_build(attributes).expect("failed to generate Mr. Mak desktop permissions");
}