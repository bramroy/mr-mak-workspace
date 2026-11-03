# Zodd Studios — Mr. Mak Integration & Coordinator Acceptance Plan V01

**Owner:** Bob (Mr. Mak integration / architecture), with implementation and independent proof delegated by named assignment.  
**Status:** Creator-directed rebuild and **workflow-first cutover**; installed production promotion remains approval-gated. **Creator rulings, 2026-11-02:** (1) legacy recovered Claude/OpenCode sessions were test fixtures, not production migration gates; (2) Sonnet is a **required integrated part of the Mr. Mak rebuild**; (3) the creator is **moving to the new coordination workflow before Wizard 3.5 is closed**, because the old workflow costs days rather than hours. Team Opus has already been informed directly.  
**Date:** 2026-11-02. **Candidate branch:** `bob/browser-backed-tabs-v01`; reference SHA before this document: `1373c22c3e7897d37b51085c1e3730baff6fa06f`.

## 1. Decision and scope

**Finish the existing Mr. Mak Workspace cockpit; do not create a parallel manager.** The product is the existing native desktop app with Bob/ChatGPT browser tabs and Claude, Codex and OpenCode worker tabs alongside Roblox Studio. A **Sonnet agent is the required coordinator/dispatcher in the rebuilt Mr. Mak**, not Codex or Bob. Bob reviews architecture/integration; GitHub remains the source of truth for assignments, decisions and verification.

**Creator-directed scope and sequence:** Build and integrate the Sonnet coordinator **in the Mr. Mak rebuild** and deploy a proved new workflow **before completing Wizard Contractor 3.5**. This is now the priority operational dependency, not a post-release extra. The old dispatcher must stop being the default after a bounded witnessed handoff; do not require the old workflow to finish 3.5 first. The new workflow itself must demonstrate model identity, persistence, real-path verification, handoff and accountable task closure. This does **not** mean Sonnet is an additional test of the game bake or that the game must await cosmetic cockpit polish/native Codex setup. Do not simultaneously dispatch the same task from both old and new coordinators. Mr. Mak personalization is not permission to change game/shared-engine repositories.

Desired outcome: a recoverable native Windows cockpit **with functioning Sonnet coordinator included** and an **early operational handoff of remaining Wizard 3.5 work**, with reviewable Ask Bob drafts, persistent receipts and independent proof. Native Codex setup and optional branding remain part of the broader rebuild but **must not delay a safe coordinator-first cutover** if Claude/OpenCode workers already cover the needed job. Complete M0, sufficient M1, M3 and an approved installation/rollback before handing off active Wizard tasks. Retirement/cleanup of obsolete worker systems remains separately audited; stopping duplicate dispatch for transferred tasks does not authorize deleting their history. Do not retire Claude as a worker.

## 2. Current evidence (source-of-truth status)

| Item | Status at this review | Evidence / limitation |
| --- | --- | --- |
| Bob browser-tabs + review-only inbox source | **IMPLEMENTED** on candidate branch; focused tests previously PASS | [Browser-session contract](BOB_BROWSER_SESSIONS_V01.md), [candidate source](https://github.com/bramroy/mr-mak-workspace/tree/bob/browser-backed-tabs-v01); implementation is not the same as production GUI acceptance. |
| Candidate automated GitHub Checks | **PASS** at `1373c22` | [Checks](https://github.com/bramroy/mr-mak-workspace/actions/runs/41357098693) |
| Candidate isolated native Windows build | **PASS** at `1373c22` | [Native Windows build](https://github.com/bramroy/mr-mak-workspace/actions/runs/41357098773). Native build PASS does not establish authentication/session usability. |
| Local sandbox UI | **PARTIAL OPERATOR EVIDENCE**, not final acceptance | Previously observed separate Tauri sandbox with 4 restored agent session records, 3 Bob records and an inbox draft. No full creator-driven native GUI/credential/focus acceptance recorded. |
| Original installed production app promoted | **NOT RUN** | Normal installation deliberately remained on the prior app; no approved upgrade/rollback execution. |
| Private runtime/profile backup restore | **NOT RUN** | Earlier local pre-integration copies were observed; no full restore proof or verified off-machine copy. Git intentionally ignores `.mrmak/`, browser profiles, credentials and runtime state. |
| Native Codex CLI availability in Mr. Mak | **FAIL / NOT AVAILABLE** on prior laptop check | App source already supports native Codex, but CLI was not resolved. Codex through OpenCode is **not** equivalent to a native Codex CLI session. |
| **Required rebuilt-app Sonnet coordinator:** wiring, actual model identity, receipt and end-to-end dispatch | **NOT RUN / REQUIRED FOR MR. MAK REBUILD** | Must be integrated into the native cockpit and accepted before M5 promotion; contracts or standalone model responses are insufficient. |
| Optional Zodd branding and project grouping | **NOT ACCEPTED** | Existing Chats grouping should be reused. No separate custom management framework. |

**Evidence freshness:** GitHub branch and CI above were checked on 2026-11-02; the authorized Windows laptop was **offline** during this review, so current local running-app state and the separate `C:\Roblox Projects\_MrMakTrial\ZoddStudio-Cockpit-Review\CLAUDE_IMPLEMENTATION_PLAN_V01.md` could not be re-read. That Claude plan and the local backups are supporting inputs to reconcile when the laptop is online, **not** a newly verified acceptance result. The earlier browser-session contract contains dated open work; use the current source and these gates rather than treating its old NOT IMPLEMENTED lines as today's definitive state.

## 3. Delivery lanes and revised workflow-first sequence

**Critical path to rescue Wizard 3.5:** M0 (current-state backup and isolated restore) + M1 (minimum native security/session/Ask Bob smoke) **in parallel with building M3** → independent end-to-end M3 proof → M5 approved installation of the Sonnet-enabled build and rollback readiness → **C1 real Wizard task handoff** → **C2 remaining Wizard 3.5 assignments transferred under a single new dispatcher**. M2 native Codex and M4 optional identity may continue on disjoint lanes, and are not extra blockers for cutover unless their specific functionality is required to complete the active Wizard task. Do not hold all agent work idle during construction: the old team can finish already-owned safety-critical tasks until each is explicitly transferred, but must not create overlapping new dispatches.

### M0 — Protect the baseline and name custodians

**Accountable:** Bob integration. **Execution:** designated local operator; independent verification by another agent.

- Confirm exact candidate Git SHA, existing installed app version/location, Windows-native installer artifact and hashes, running sessions, WebView2 profile location and current project selection.
- Back up installed binary, current settings, **current** Bob conversation links/drafts and active login/profile into an approved private location. Legacy recovered agent sessions were only test fixtures and are **not** required for production migration or restoration. Keep credentials, cookies, transcripts and `.mrmak/` **out of public Git**. Record hashes, backup path privately and perform a restoration to an isolated sandbox.
- Confirm upstream divergence and safe rollback. Never move original repository pointers, interrupt live workers or overwrite installed app to run proof.

**Gate M0:** **PASS** only with a manifest plus isolated restore and named custodian. Existing copies without restore = **NOT RUN**.

### M1 — Native cockpit functional and security acceptance

**Implementation:** bounded Tauri/React worker. **Verifier:** independent Windows operator plus creator visual witness.

On the *same exact candidate build*:
- Open two real Bob/ChatGPT conversations alongside fresh Claude/OpenCode terminals; tab switch, rename, close/reopen and app restart without losing current links, draft composition or **newly created** worker sessions. Former proof sessions need not reappear. Prove ChatGPT login survives restart using its isolated profile.
- Test focus, scrolling, clipping and tab switches, secondary-monitor/DPI movement and window resizing. Test inbox open/copy/close/return; child WebView2 must not cover the inbox. **No automatic ChatGPT sends.**
- Negative security proof: untrusted ChatGPT origins cannot invoke privileged native IPC, read local bearer tokens, issue terminal/file actions or drive coordinator tools. URL/domain allowlist must refuse unsafe destinations. Confirm remote login/auth is not being passed as local service credentials.
- Record OAuth popups, attachments and voice separately as PASS/FAIL/NOT RUN. If some unsupported, clearly disclose and obtain a scoped release disposition; don't invent parity.

**Gate M1:** named build SHA + creator-readable witness + independent security/negative result. CI/native compilation alone cannot close M1.

### M2 — Native agent wrappers and conversation custody

**Implementation:** agent-integration worker. **Verifier:** independent reviewer.

- Confirm fresh Claude and OpenCode sessions work with their configured provider/subscription routes, and reopening the cockpit does not unexpectedly spawn or kill **current** workers. Recovery of legacy proof sessions is **not a gate**.
- Install or locate native Codex CLI **only in an explicitly approved local setup**, connect it to Mr. Mak's existing `Codex` agent path, verify real model/provider and login, and complete one harmless prompt in its native tab.
- Do not relabel old **OpenCode → Codex** proof records as native Codex or silently migrate private session stores. Those historical sessions are **not required for go-live**; no extra API keys/billing are assumed.
- Test a missing/unconfigured Codex CLI refusal with a clear recovery message instead of an inert or misleading tab.

**Gate M2:** witnessed native Codex session **PASS**, existing sessions remain intact, no surprise billing/config rewrite.

### M3 — Build, integrate and prove the Sonnet coordinator in Mr. Mak (required rebuild scope)

**Accountable:** integration owner; **built-in dispatcher:** Sonnet; **implementation:** Claude team using existing Mr. Mak architecture; **verifier:** non-author agent. **Creator:** consequential deployment approval. M3 is a core product deliverable and may be implemented in parallel with other nonconflicting rebuild work; do not postpone it until after a cockpit-only release.

Implement the coordinator inside the rebuilt Mr. Mak's existing agent/Chats and GitHub workflow, then use an isolated, disposable **non-game** task for its acceptance proof (no production merge):
1. Wire Sonnet into the native Mr. Mak coordinator path with an explicit persisted role charter, task ownership and handoff state. Prove the **actual** model/provider, permissions/budget and dispatcher instance; do not infer identity from a tab label or wrapper.
2. Read an approved GitHub task; acknowledge ownership and exact SHA; check current worker/guard and avoid duplicate dispatch.
3. Assign one small, bounded task to a distinct worker, with exact input and an expected behavior test plus a negative case that fails on the real path.
4. Receive a real commit/evidence receipt, have a **different** reviewer run or inspect the proof, distinguish PASS/FAIL/NOT RUN, and escalate a real exception using the review-only Ask Bob draft (creator must send explicitly).
5. Restart/replace **only the isolated test coordinator session**. Show the role charter, task state, pending ownership and evidence survive handoff, with one dispatcher per assignment. Close the GitHub task with a receipt.

**Gate M3 (mandatory for Mr. Mak rebuild and workflow-first cutover):** native integration, complete end-to-end task receipt, independent verdict, restart continuity and negative proof **PASS** on the rebuilt candidate. Skills, screenshots or one model reply do not count. M3 is **required before M5**. The creator expressly wants the new Sonnet workflow used **to finish Wizard 3.5**; it must therefore be operational and take responsibility for remaining work before the final bake/closure, after the bounded C1 handoff. No premature dual dispatch.

### M4 — Zodd Studios personalization (nonblocking for coordinator-first cutover)

**Implementation:** one UI owner at a time; **review:** Bob + creator.

- Reuse existing Chats tab groups to distinguish `Wizard`, `WorldTools`, `Doo`, `Studio Operations` and `Bob / Reviews`. Grouping is presentation, never an alternate status ledger.
- Show review draft source/title/time; optionally `copied`/`sent by creator` status without sending or reading private ChatGPT conversations.
- Optional Zodd Studios accent/identity through small settings/theme tokens; retain upstream compatibility and source diffs. No new framework, dashboard, extra editor or browser automation.
- Incorporate only creator-confirmed preferences into context; don't invent personal settings.

**Gate M4:** creator screenshot/readability witness and narrow regression for sessions, grouping, inbox and history. Cosmetics are not a precondition for coordinator proof.

### M5 — Installed promotion, rollback and operating handoff

**Owner:** Bob integration. **Execution:** local operator after explicit creator go; **verifier:** independent QA.

- Compare exactly approved CI artifact/commit hash to candidate; check installer safety and isolate a rollback rehearsal on a copy. Ensure protected local profiles and old installed state recover.
- Choose a quiet window with creator permission; **do not automatically restart** Mr. Mak or disrupt working agents. Install the **integrated Sonnet-coordinator build**, launch and rerun M1/M2 smoke tests plus an **installed M3 coordinator task/handoff continuity smoke**. No cockpit-only production promotion that leaves Sonnet for later.
- If regression occurs, restore the original installed build and separately protected **current** state. Historic test-session restoration is optional, not a reason to delay promotion. Record exact PASS/FAIL/NOT RUN rather than declaring installation a success.
- Publish an operations note: how to open the correct Bob conversation, route Ask Bob drafts, start native Codex, recover sessions, find GitHub receipts and back out safely.

**Gate M5 (urgent coordinator-enabled operational installation):** user-observed installed version **including Sonnet coordinator**, M0/M1/M3 acceptance, verified rollback and explicit creator approval. M2 native Codex and M4 cosmetics must be fully accepted for their own deliverables but may follow the coordinator-first deployment when not needed for active work. Begin C1/C2 immediately after approved M5 and independent proof. Decommissioning/cleaning up the old workflow still requires the producer's separate retirement audit.

### C1 / C2 — Live Wizard 3.5 workflow takeover (before final bake)

**C1 — witnessed transfer:** The existing producer identifies **one bounded outstanding Wizard 3.5 task** from the current canonical punch list, exact game/build SHA and incumbent owner. The new Sonnet coordinator acknowledges it in GitHub, checks for active ownership and permitted worker/model, dispatches one task without duplicating the old dispatcher, receives a real-path behavior proof **including a failing negative**, requests a non-author verdict, posts the exact-SHA receipt and same-day closeout. Creator playtest wording remains the acceptance sentence; where a cause exists, include the kaizen cause card. Keep privileged merge/release authority with the actual owner. **PASS** only if the task really moved under the new operating contract.

**C2 — remaining work:** After a C1 PASS, the producer transfers each remaining 3.5 owner/task with an acknowledgement, named receiver and GitHub source. The old coordinator ceases dispatch for these transferred tasks; preserve rollback and history. The new coordinator then drives the remaining release work through the new rules, including normal-scope fixes/merges, independent proofs and the real final bake. No duplicated status ledger, unowned tasks, dual dispatch or temporary loss of creator decisions. The owner retains public-release go/no-go.

**Cutover is a gate on changing dispatchers, not a pretext for another set of generic headless game tests; the real Wizard task provides the proof.**

## 4. Authority and operating rules

| Decision/action | Authority |
| --- | --- |
| Scoped code/tests on a candidate branch, no running-worker interference | Named implementation owner, with reviewer and exact-SHA receipt |
| Architectural boundaries, model/auth/security review | Bob integration |
| Existing Wizard task before acknowledged transfer | Incumbent producer-authorized owner; do not duplicate dispatch |
| Wizard tasks after C1 PASS and C2 acknowledged per-task transfer | New native Sonnet coordinator owns dispatch/receipts; existing release owner retains consequential technical/public-release authority |
| Implement and independently prove Sonnet coordinator **within the rebuilt app** | Named M3 implementation and verification owners; non-production test tasks until creator-approved installed deployment |
| Change active dispatcher or promote native installed build | Creator go/no-go after independent evidence |
| Public Roblox release, game-engine merges or repins | Owning release authority; **out of scope** |
| Delete sessions/worktrees, share private profiles, send to ChatGPT automatically | **Not authorized by this plan** |

Use one durable issue/PR/commit receipt per task. No second shadow backlog in Mr. Mak. Escalate consequential changes, not routine repairs. Producer Desk can carry decisions, but Mr. Mak-specific implementation evidence stays in this repository and links back to the desk.

## 5. Immediate bounded next actions

1. **Integration owner (Bob):** maintain this plan, review exact-SHA proofs, request a named local Windows executor when the laptop reconnects. Reconcile the existing Claude plan and current branch; document any differences explicitly.
2. **Windows QA / app builder:** perform M0 private backup+restore and M1 native security/UX witness without touching the installed app. Report exact version, screen evidence, negative tests and remaining blockers.
3. **Native agent owner (parallel/nonblocking):** verify Codex CLI absence/presence and prepare a contained native installation/proof proposal. Do **not** install or migrate sessions without approval. Codex need not block a functioning Sonnet-to-Claude/OpenCode task path.
4. **Sonnet coordinator owner (critical path):** build and prove M3 in the actual native app, then prepare M5 rollback/installed acceptance and coordinate **C1 live Wizard task handoff followed by C2**. This new operational workflow is to be in use **before Wizard 3.5 completion**.
5. **After integrated M0/M1/M3 gates:** rehearse rollback and request creator approval to promote the **Sonnet-enabled rebuilt app**; complete C1/C2 before the Wizard final bake/closure. Finish noncritical M2/M4 improvements without delaying this move.

**Explicitly NOT RUN now:** local backup restore of the **current** cockpit state; native GUI/login stress on the exact final build; security/UI operator witness; native Codex; live Sonnet coordinator; installed promotion; retirement. This file is a **plan and accountability baseline**, not proof that these actions happened.
