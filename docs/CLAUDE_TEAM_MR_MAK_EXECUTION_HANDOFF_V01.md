# Claude Team — Mr. Mak Integration Execution Handoff V01

**Date:** 2026-11-02  
**Accountable integration reviewer:** Bob  
**Implementers:** Claude team, with named independent verifier per workstream  
**Canonical plan:** [Zodd Studios Mr. Mak Integration & Coordinator Acceptance Plan V01](ZODD_STUDIOS_MR_MAK_INTEGRATION_PLAN_V01.md)  
**Candidate:** `bob/browser-backed-tabs-v01`; original integration baseline `1373c22`; follow current plan branch head. **Creator ruling, 2026-11-02:** Sonnet coordinator is a **required part of the Mr. Mak rebuild**. Team Opus has already been advised; do not request reconfirmation.

## Mission

Complete the **existing** Mr. Mak Workspace native cockpit: real Bob/ChatGPT tabs and Ask Bob draft inbox; fresh Claude/OpenCode sessions; a properly supported **native Codex CLI**; a **built-in, integrated and independently verified Sonnet coordinator (mandatory)**; optional modest Zodd Studios identity; and safe, approved promotion to the installed Windows app. Reuse upstream architecture and existing tabs/grouping/CLI plumbing. Do **not** build a replacement coordinator framework or a parallel backlog.

**Creator scope override:** Implement Sonnet as **part of the native Mr. Mak rebuild**, not a separate later project or optional future cutover. Its model identity, persistence, task dispatch and reviewer evidence are **mandatory rebuilt-app acceptance criteria before installed promotion (M5)**. Wizard 3.5 can proceed under its existing producer-authorized rules; completion of the Mr. Mak coordinator is **not** a gate on the game bake. Bob handles this integration desk; the game release owner handles Wizard.

**Creator clarification:** the previously recovered Claude/OpenCode agent sessions were **proof fixtures**. They are **not** production sessions that must migrate or survive as acceptance gates. Keep current Bob conversation links, login/profile and active user work safe. Don't deliberately destroy old fixtures in the course of this task; after a private rollback backup, old fixture retention is optional. New real agent sessions prove current behavior.

## Initial assignments — acknowledge before implementation

| Lane | Owner to name | Independent proof | Allowed now / boundaries |
| --- | --- | --- | --- |
| **M0 — baseline / rollback** | Windows QA custodian | non-author restoring a sandbox copy | Inventory candidate SHA, installed version, Bob links/drafts and profile; private backup + **actual isolated restore**. Do not restart or replace installed app. |
| **M1 — native GUI/security** | Tauri/React integration custodian | separate Windows verifier + creator visual acceptance later | Native WebView2 two-Bob-tab test, fresh Claude/OpenCode, login restart, focus/resize/multi-monitor DPI, inbox copy/return and negative remote-origin privilege tests. Track OAuth/voice/upload separately. |
| **M2 — native Codex** | CLI integration custodian | separate reviewer | Inspect why `codex` is unavailable on PATH; prepare bounded setup and wrapper check. **Do not install globally, change login or spend money** without creator permission. No historical OpenCode/Codex migration gate. |
| **M3 — integrated Sonnet coordinator (required rebuild feature)** | Sonnet/desktop integration implementer | distinct worker/tester | **Build into Mr. Mak** with persisted role charter, verified Sonnet provider/model, GitHub-backed ownership/receipts, assigned worker and review workflow; then prove via disposable **non-game** task: acknowledgement, dispatch, exact-SHA receipt, real-path positive and failing negative test, independent verdict, reviewed Ask Bob draft, reconstituted coordinator state, one-dispatcher guarantee. No premature production dispatcher cutover. **M3 must pass before M5.** |
| **M4 — optional identity** | single UI owner after M1 | creator witness | Existing tab groups, reviewed inbox source/time, minimal styling. Serialize changes to shared `BobTabs.tsx` / CSS files. |
| **M5 — production promotion of complete rebuild** | release operator only after creator go | independent install + rollback verifier | **HOLD** until M0–M3 pass, including Sonnet wired into candidate. Prepare final artifact/manifest and rehearsal only. No installation, app restart, profile migration or session shutdown without approval. |

**Scheduling:** Begin M0/M1 baseline and **M3 coordinator implementation concurrently** on disjoint files, with an independent verifier; M2 Codex diagnosis can also proceed within available proof capacity. **Do not defer M3 to post-release or treat it as test-design only**. Avoid colliding edits or an uncontrolled swarm. M4 follows the stable GUI baseline; M5 requires M0–M3 integrated proof, applicable M4 acceptance and creator authorization.

## Evidence contract

For every claim give: `LANE | OWNER | exact branch/SHA | affected files | check/test commands | observed PASS / FAIL / NOT RUN | real-path negative case | native visual witness | independently checked by | remaining blocker`. A passing Rust build or headless test **does not** prove ChatGPT login, Tauri native child view, role identity, or production-installed usability.

Known GitHub evidence: candidate [Checks](https://github.com/bramroy/mr-mak-workspace/actions/runs/41357098693) and [native Windows build](https://github.com/bramroy/mr-mak-workspace/actions/runs/41357098773) passed at `1373c22`. The installed app has **not** been promoted. Local Claude planning input: `C:\Roblox Projects\_MrMakTrial\ZoddStudio-Cockpit-Review\CLAUDE_IMPLEMENTATION_PLAN_V01.md`. The legacy [Bob browser-tabs contract](BOB_BROWSER_SESSIONS_V01.md) is a reference, not an up-to-date acceptance certificate.

**Safety:** no game/shared-engine edits; no worker stop; no force pushes; no public credentials or WebView2 profile files; no automatic sends to ChatGPT; no new API billing; no secret copying; no production install/merge/retirement. Report blockers without disabling guards.

## Next handoff back to Bob

Provide one concise **current-state / ownership / M0–M1 proof** digest with exact SHA and screenshots or references to them. Tell Bob what can safely be delegated next. Ask the creator only for consequential setup, install or architectural choices; ordinary candidate repairs do not need a serial approval campaign.

This is a live execution packet authorizing **scoped Sonnet coordinator implementation as part of the Mr. Mak candidate rebuild**, not unilateral production installation, live dispatcher cutover, workflow retirement or changes to Wizard 3.5. The creator has already directed Opus on the coordinator decision.
