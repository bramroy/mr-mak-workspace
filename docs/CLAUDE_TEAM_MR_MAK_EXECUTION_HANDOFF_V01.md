# Claude Team — Mr. Mak Integration Execution Handoff V01

**Date:** 2026-11-02  
**Accountable integration reviewer:** Bob  
**Implementers:** Claude team, with named independent verifier per workstream  
**Canonical plan:** [Zodd Studios Mr. Mak Integration & Coordinator Acceptance Plan V01](ZODD_STUDIOS_MR_MAK_INTEGRATION_PLAN_V01.md)  
**Candidate:** `bob/browser-backed-tabs-v01`; original integration baseline `1373c22`; follow current plan branch head. **Creator ruling, 2026-11-02:** Sonnet coordinator is a **required part of the Mr. Mak rebuild**. Team Opus has already been advised; do not request reconfirmation.

## Mission

Complete the **existing** Mr. Mak Workspace native cockpit: real Bob/ChatGPT tabs and Ask Bob draft inbox; fresh Claude/OpenCode sessions; a properly supported **native Codex CLI**; a **built-in, integrated and independently verified Sonnet coordinator (mandatory)**; optional modest Zodd Studios identity; and safe, approved promotion to the installed Windows app. Reuse upstream architecture and existing tabs/grouping/CLI plumbing. Do **not** build a replacement coordinator framework or a parallel backlog.

**Creator's controlling ruling (2026-11-02):** The Sonnet coordinator **must be built into this Mr. Mak rebuild**, and the new coordination workflow must **take over remaining Wizard 3.5 work before the game is finished**. The existing workflow is costing the creator days, not hours. Therefore: **prioritize Sonnet build + acceptance + safe installed promotion + first live 3.5 task handoff now**, not after the bake. Bob owns Mr. Mak integration review; the producer retains Wizard release control. Do not ask Opus to reconfirm a decision the creator already gave directly.

**Creator clarification:** the previously recovered Claude/OpenCode agent sessions were **proof fixtures**. They are **not** production sessions that must migrate or survive as acceptance gates. Keep current Bob conversation links, login/profile and active user work safe. Don't deliberately destroy old fixtures in the course of this task; after a private rollback backup, old fixture retention is optional. New real agent sessions prove current behavior.

## Initial assignments — acknowledge before implementation

| Lane | Owner to name | Independent proof | Allowed now / boundaries |
| --- | --- | --- | --- |
| **M0 — baseline / rollback** | Windows QA custodian | non-author restoring a sandbox copy | Inventory candidate SHA, installed version, Bob links/drafts and profile; private backup + **actual isolated restore**. Do not restart or replace installed app. |
| **M1 — native GUI/security** | Tauri/React integration custodian | separate Windows verifier + creator visual acceptance later | Native WebView2 two-Bob-tab test, fresh Claude/OpenCode, login restart, focus/resize/multi-monitor DPI, inbox copy/return and negative remote-origin privilege tests. Track OAuth/voice/upload separately. |
| **M2 — native Codex (parallel, not cutover blocker)** | CLI integration custodian | separate reviewer | Inspect why `codex` is unavailable on PATH; prepare bounded setup and wrapper check. **Do not install globally, change login or spend money** without creator permission. No historical OpenCode/Codex migration gate. Existing Claude/OpenCode workers may carry the first Sonnet-controlled Wizard task. |
| **M3 — integrated Sonnet coordinator (critical path)** | Sonnet/desktop integration implementer | distinct worker/tester | **Build into Mr. Mak** with persisted charter, verified Sonnet model/provider, GitHub-backed ownership/receipts, real worker dispatch/review, Ask Bob draft and handoff continuity. Prove one bounded non-production task with real-path positive and failing negative test, independent verdict and one-dispatcher guard. **M3 must pass before M5 and the C1 live Wizard handoff.** |
| **M4 — optional identity (nonblocking)** | single UI owner after M1 | creator witness | Existing tab groups, reviewed inbox source/time, minimal styling. Serialize changes to shared `BobTabs.tsx` / CSS files. **Do not postpone a proved coordinator cutover for colors or cosmetic grouping.** |
| **M5 — promote coordinator-enabled rebuild (early priority)** | release operator only after creator go | independent install + rollback verifier | **HOLD** until M0, essential M1 and M3 PASS, then request approval to install the **Sonnet-enabled** candidate with verified backup/rollback. M2/M4 improvements may follow if not needed for the new task path. No unilateral app restart or profile migration. **C1/C2 must follow approved promotion before Wizard 3.5 closure.** |

**Scheduling (creator-directed):** Run M0 minimal backup/restore and essential M1 native/security acceptance **in parallel with actual M3 implementation**. Then independently verify M3, rehearse rollback, request creator-approved M5, and immediately conduct **C1 one real outstanding Wizard 3.5 task** with cause card, creator-phrase behavior test, real-path failing negative, independent verdict and exact-SHA receipt. After C1 PASS, **C2 transfer the remaining 3.5 tasks one by one with acknowledged custody and a single dispatcher**, then finish the bake under the new workflow. Native Codex (M2) and visual identity (M4) may proceed on disjoint paths and are not cutover blockers unless active work needs them. Never dispatch the same task from two coordinators.

## Evidence contract

For every claim give: `LANE | OWNER | exact branch/SHA | affected files | check/test commands | observed PASS / FAIL / NOT RUN | real-path negative case | native visual witness | independently checked by | remaining blocker`. A passing Rust build or headless test **does not** prove ChatGPT login, Tauri native child view, role identity, or production-installed usability.

Known GitHub evidence: candidate [Checks](https://github.com/bramroy/mr-mak-workspace/actions/runs/41357098693) and [native Windows build](https://github.com/bramroy/mr-mak-workspace/actions/runs/41357098773) passed at `1373c22`. The installed app has **not** been promoted. Local Claude planning input: `C:\Roblox Projects\_MrMakTrial\ZoddStudio-Cockpit-Review\CLAUDE_IMPLEMENTATION_PLAN_V01.md`. The legacy [Bob browser-tabs contract](BOB_BROWSER_SESSIONS_V01.md) is a reference, not an up-to-date acceptance certificate.

**Safety:** no game/shared-engine edits; no worker stop; no force pushes; no public credentials or WebView2 profile files; no automatic sends to ChatGPT; no new API billing; no secret copying; no production install/merge/retirement. Report blockers without disabling guards.

## Next handoff back to Bob

Provide a single **M0/M1/M3 build + independent proof + installation-readiness** digest with exact SHAs, native screenshots, negative tests, model identity and remaining blockers. Recommend the exact approved M5 promotion action and **C1 Wizard task for the first real takeover**, then C2 owner transfer plan. Do not seek repeated permission for routine candidate code fixes. The creator retains approval for installed promotion and consequential changes.

This handoff authorizes **scoped Sonnet coordinator implementation and an operational readiness proposal before 3.5 closes**, not unilateral installation, dual dispatch, destructive retirement or changes to game engines. Opus has already received the creator's direction.
