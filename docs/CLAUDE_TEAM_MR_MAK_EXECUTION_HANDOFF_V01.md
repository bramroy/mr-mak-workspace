# Claude Team — Mr. Mak Integration Execution Handoff V01

**Date:** 2026-11-02  
**Accountable integration reviewer:** Bob  
**Implementers:** Claude team, with named independent verifier per workstream  
**Canonical plan:** [Zodd Studios Mr. Mak Integration & Coordinator Acceptance Plan V01](ZODD_STUDIOS_MR_MAK_INTEGRATION_PLAN_V01.md)  
**Candidate:** `bob/browser-backed-tabs-v01`; working code baseline `1373c22`; plan clarification `8346946c`.

## Mission

Complete the **existing** Mr. Mak Workspace native cockpit: real Bob/ChatGPT tabs and Ask Bob draft inbox; fresh Claude/OpenCode sessions; a properly supported **native Codex CLI**; a separately verified **Sonnet coordinator**; optional modest Zodd Studios identity; and safe, approved promotion to the installed Windows app. Reuse upstream architecture and existing tabs/grouping/CLI plumbing. Do **not** build a replacement coordinator framework or a parallel backlog.

**Critical separation:** Wizard 3.5 may run the new engineering rules with its existing release coordinator now. The Sonnet dispatcher proof is **NOT** a Wizard 3.5 release dependency. Bob handles this Mr. Mak integration desk; the game release owner handles the bake.

**Creator clarification:** the previously recovered Claude/OpenCode agent sessions were **proof fixtures**. They are **not** production sessions that must migrate or survive as acceptance gates. Keep current Bob conversation links, login/profile and active user work safe. Don't deliberately destroy old fixtures in the course of this task; after a private rollback backup, old fixture retention is optional. New real agent sessions prove current behavior.

## Initial assignments — acknowledge before implementation

| Lane | Owner to name | Independent proof | Allowed now / boundaries |
| --- | --- | --- | --- |
| **M0 — baseline / rollback** | Windows QA custodian | non-author restoring a sandbox copy | Inventory candidate SHA, installed version, Bob links/drafts and profile; private backup + **actual isolated restore**. Do not restart or replace installed app. |
| **M1 — native GUI/security** | Tauri/React integration custodian | separate Windows verifier + creator visual acceptance later | Native WebView2 two-Bob-tab test, fresh Claude/OpenCode, login restart, focus/resize/multi-monitor DPI, inbox copy/return and negative remote-origin privilege tests. Track OAuth/voice/upload separately. |
| **M2 — native Codex** | CLI integration custodian | separate reviewer | Inspect why `codex` is unavailable on PATH; prepare bounded setup and wrapper check. **Do not install globally, change login or spend money** without creator permission. No historical OpenCode/Codex migration gate. |
| **M3 — Sonnet coordinator** | coordinator proof custodian | distinct worker/tester | Disposable **non-game** one-task test: model identity, acknowledgement, task dispatch, exact-SHA receipt, behavior test + failing negative on real path, independent verdict, reviewed Ask Bob draft, reconstituted coordinator state and one-dispatcher guarantee. No production agent cutover. |
| **M4 — optional identity** | single UI owner after M1 | creator witness | Existing tab groups, reviewed inbox source/time, minimal styling. Serialize changes to shared `BobTabs.tsx` / CSS files. |
| **M5 — production promotion** | release operator only after creator go | independent install + rollback verifier | **HOLD**. Prepare final artifact/manifest and rehearsal only. No installation, app restart, profile migration or session shutdown without approval. |

**Scheduling:** Start M0 and M1 in a bounded fashion, with one independent verifier. M2 analysis and M3 proof design may run in parallel on disjoint code. Avoid an agent swarm or colliding edits. M4 comes after GUI baseline is stable; M5 requires all explicit gates and creator authorization.

## Evidence contract

For every claim give: `LANE | OWNER | exact branch/SHA | affected files | check/test commands | observed PASS / FAIL / NOT RUN | real-path negative case | native visual witness | independently checked by | remaining blocker`. A passing Rust build or headless test **does not** prove ChatGPT login, Tauri native child view, role identity, or production-installed usability.

Known GitHub evidence: candidate [Checks](https://github.com/bramroy/mr-mak-workspace/actions/runs/41357098693) and [native Windows build](https://github.com/bramroy/mr-mak-workspace/actions/runs/41357098773) passed at `1373c22`. The installed app has **not** been promoted. Local Claude planning input: `C:\Roblox Projects\_MrMakTrial\ZoddStudio-Cockpit-Review\CLAUDE_IMPLEMENTATION_PLAN_V01.md`. The legacy [Bob browser-tabs contract](BOB_BROWSER_SESSIONS_V01.md) is a reference, not an up-to-date acceptance certificate.

**Safety:** no game/shared-engine edits; no worker stop; no force pushes; no public credentials or WebView2 profile files; no automatic sends to ChatGPT; no new API billing; no secret copying; no production install/merge/retirement. Report blockers without disabling guards.

## Next handoff back to Bob

Provide one concise **current-state / ownership / M0–M1 proof** digest with exact SHA and screenshots or references to them. Tell Bob what can safely be delegated next. Ask the creator only for consequential setup, install or architectural choices; ordinary candidate repairs do not need a serial approval campaign.

This is a live execution packet for the existing team, **not** authorization to cut over the Sonnet coordinator or affect Wizard 3.5.
