# Bob Browser Sessions V01 — Native Cockpit Contract

Branch: bob/browser-backed-tabs-v01, isolated from upstream PR #75 (5bbdb1b).

Goal: Multiple real ChatGPT/Bob conversations inside the EXISTING Mr. Mak — Chats window, with one shared authenticated ChatGPT profile, persistent conversation tabs, and no additional OpenAI API billing.

## Expected experience

1. + -> ChatGPT / Bob -> New conversation or Open existing by URL.
2. Multiple Bob tabs alongside Claude, Codex and OpenCode, with independent URLs, names, pin/group/order and history.
3. Switch tabs without recreating the browser page or discarding ChatGPT's scroll/composition state.
4. Closing a browser tab retains its conversation link in History, never interrupts native CLI workers.
5. Restarting the cockpit restores saved Bob tabs and their conversation URLs; shared ChatGPT login persists.
6. Claude coordinator Ask Bob submits a REVIEWABLE LOCAL DRAFT (title, question, optional source chat), not a message automatically sent to ChatGPT. The owner reviews and explicitly submits.

## Backend implemented and tested

- desktop/service/browser-tabs.mjs: durable allowlisted browser records in stateDir/browser-tabs.json, independent from CLI sessions.
- desktop/service/bob-questions.mjs: durable drafts in stateDir/bob-questions.json, no ChatGPT network send.
- desktop/service/server.mjs: authenticated browser-tab and draft endpoints, broadcasts updates, exposes state in bootstrap.
- desktop/service/coordinator.mjs: ask_bob tool clearly advertised as draft-only.
- Three new test files exercise URL guards, persistence, two concurrent Bob tabs, auth, reload, and no terminal privilege inheritance.

## Native UI still required

- Compose browser-backed records into the existing React tab strip and existing + flow, preserving existing terminal tabs, grouping, rename, pin, reorder and History behavior.
- Add native child WebView2 to the same Chats window and position it over the browser chat body. Maintain independent WebView2 instances per Bob tab. Hide/show and resize without navigation on every switch; close only when the owner closes the tab.
- Tauri 2 child webviews require the unstable Cargo feature. No Rust toolchain is present on this Windows laptop, so this needs a separate native build/CI proof.
- Strictly isolate remote ChatGPT origins from the local desktop bearer token, native IPC, files, terminal controls and coordinator tools. Persist WebView2 login through an isolated shared browser profile, without copying cookies from Bob Chrome.
- ChatGPT login redirection, browser cookie reuse, voice/attachments, and same-thread recovery require real Windows testing. Earlier separate WebView2 proof loaded ChatGPT's login screen, but did NOT prove the in-window child webview or login persistence.
- Ordinary third-party iframes do not meet the requirement (ChatGPT sends X-Frame-Options SAMEORIGIN).

## Acceptance gates

PASS: Isolated branch, allowlisted HTTPS conversation URLs, duplicate independent saved tabs, close/reopen, update/pin/group/order, auth, no CLI process creation, draft queue without external submission.
NOT IMPLEMENTED: ChatTabs/+ integration, Rust child webview lifecycle, visible Bob draft review/send UI.
NOT RUN: Rust/Tauri build, in-window login/voice/attachments, multi-tab restoration acceptance and performance.
UPSTREAM: Do not merge or repin PR #75 to production solely based on the backend proof.

Safety: No API key, no automated DOM sends, no native app replacement, no game repository changes, no fake iframe completion.


## November 1 native Windows preview (isolated shell, not Tauri)

- Added browser-backed tabs to the existing React Chats strip and new-chat picker. Browser-tab selection swaps the main content area; history can reopen saved tabs; pin and rename are exposed.
- Added review-only coordinator Ask Bob inbox UI (copy to clipboard; no automatic submission).
- Proved a **real WebView2** ChatGPT session in the chat area, under the Bob tab strip, using an isolated WinForms proof host compiled with the .NET Framework C# compiler. Evidence in the local preview's log: UI_NAVIGATION_DONE success=True; BOB_TABS_RENDERED=2; BOB_VIEW_CREATED.
- The host uses a separate WebView2 profile for ChatGPT versus the localhost Mr. Mak UI. Remote chat pages do not receive host objects or privileged native messages.
- The proof hosted a copy of four stopped agent sessions plus two saved Bob conversations. **No CLI worker was resumed.**
- Proof source is in proofs/bob-native/BobCockpitPreview.cs. SDK DLLs, compiled executables, browser profiles and screenshots are deliberately not committed. The local preview lives outside this Git branch.
- **NOT YET PASSED**: production Tauri 2 child-webview implementation and Rust build, genuine login survival after a desktop restart, browser tab drag/reorder parity with agent tabs, OAuth/voice/file-upload acceptance, native focus/resize stress.
- **IMPORTANT**: This temporary WinForms host receives the localhost bootstrap URL as a process argument. Never ship that strategy as a production credential transport; reuse Mr. Mak's native token bootstrapping and isolate remote webviews from the local IPC bridge.

This is a true native Windows integration *preview*, not a release of the installed Mr. Mak Workspace application.
