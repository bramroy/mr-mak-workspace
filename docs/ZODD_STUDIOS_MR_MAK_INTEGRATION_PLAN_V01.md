# Zodd Studios — Mr. Mak Integration & Coordinator Acceptance Plan V01

**Owner:** Bob (Mr. Mak integration / architecture), with implementation and independent proof delegated by named assignment.  
**Status:** Proposed delivery baseline; no production promotion or coordinator cutover authorized. **Creator clarification, 2026-11-02:** recovered legacy Claude/OpenCode sessions were test fixtures for the cockpit, not production sessions requiring migration or preservation as a release gate.  
**Date:** 2026-11-02. **Candidate branch:** `bob/browser-backed-tabs-v01`; reference SHA before this document: `1373c22c3e7897d37b51085c1e3730baff6fa06f`.

## 1. Decision and scope

**Finish the existing Mr. Mak Workspace cockpit; do not create a parallel manager.** The product is the existing native desktop app with Bob/ChatGPT browser tabs and Claude, Codex and OpenCode worker tabs alongside Roblox Studio. A **Sonnet agent** is the *candidate future coordinator/dispatcher*, not Codex or Bob. Bob reviews architecture/integration; GitHub remains the source of truth for assignments, decisions and verification.

**Separate the tracks:** Wizard Contractor 3.5 may adopt the new engineering rules now, using its existing authorized dispatcher and release owner. The **unproven Sonnet coordinator is NOT a Wizard 3.5 release gate**. Its proof and eventual cutover belong to this plan. Likewise, no Mr. Mak personalization is permission to change game/shared-engine repositories.

Desired outcome: a recoverable, stable native Windows cockpit, optional Zodd Studios presentation, native Codex availability, reviewable Ask Bob handoffs, and one evidence-backed coordinator task that survives a session handoff. Only then consider retiring the old dispatcher workflow. Do not retire Claude as a worker.

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
| Sonnet coordinator actual model/identity, receipt and end-to-end dispatch | **NOT RUN** | Skills/contracts and Producer Desk discussions do not substitute for a live task or model-identity check. |
| Optional Zodd branding and project grouping | **NOT ACCEPTED** | Existing Chats grouping should be reused. No separate custom management framework. |

**Evidence freshness:** GitHub branch and CI above were checked on 2026-11-02; the authorized Windows laptop was **offline** during this review, so current local running-app state and the separate `C:\Roblox Projects\_MrMakTrial\ZoddStudio-Cockpit-Review\CLAUDE_IMPLEMENTATION_PLAN_V01.md` could not be re-read. That Claude plan and the local backups are supporting inputs to reconcile when the laptop is online, **not** a newly verified acceptance result. The earlier browser-session contract contains dated open work; use the current source and these gates rather than treating its old NOT IMPLEMENTED lines as today's definitive state.

## 3. Delivery lanes, in required order

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

### M3 — Sonnet coordinator contract and bounded end-to-end proof (separate from 3.5)

**Accountable:** integration owner; **candidate dispatcher:** Sonnet; **verifier:** non-author agent. **Creator:** only consequential/cutover authority.

Use an isolated, disposable **non-game** task with no production merge:
1. Explicitly identify actual model/provider, role charter, permissions/budget and which instance is dispatcher. Do not infer model from a label or OpenCode wrapper.
2. Read an approved GitHub task; acknowledge ownership and exact SHA; check current worker/guard and avoid duplicate dispatch.
3. Assign one small, bounded task to a distinct worker, with exact input and an expected behavior test plus a negative case that fails on the real path.
4. Receive a real commit/evidence receipt, have a **different** reviewer run or inspect the proof, distinguish PASS/FAIL/NOT RUN, and escalate a real exception using the review-only Ask Bob draft (creator must send explicitly).
5. Restart/replace **only the isolated test coordinator session**. Show the role charter, task state, pending ownership and evidence survive handoff, with one dispatcher per assignment. Close the GitHub task with a receipt.

**Gate M3:** complete end-to-end evidence and negative proof **PASS**. No “skills installed,” screenshot, chat promise or one model response counts. Until this passes, the old dispatcher remains the authority for its active assignments. **M3 must not block the Wizard 3.5 bake.**

### M4 — Minimal Zodd Studios personalization (only after M1 is stable)

**Implementation:** one UI owner at a time; **review:** Bob + creator.

- Reuse existing Chats tab groups to distinguish `Wizard`, `WorldTools`, `Doo`, `Studio Operations` and `Bob / Reviews`. Grouping is presentation, never an alternate status ledger.
- Show review draft source/title/time; optionally `copied`/`sent by creator` status without sending or reading private ChatGPT conversations.
- Optional Zodd Studios accent/identity through small settings/theme tokens; retain upstream compatibility and source diffs. No new framework, dashboard, extra editor or browser automation.
- Incorporate only creator-confirmed preferences into context; don't invent personal settings.

**Gate M4:** creator screenshot/readability witness and narrow regression for sessions, grouping, inbox and history. Cosmetics are not a precondition for coordinator proof.

### M5 — Installed promotion, rollback and operating handoff

**Owner:** Bob integration. **Execution:** local operator after explicit creator go; **verifier:** independent QA.

- Compare exactly approved CI artifact/commit hash to candidate; check installer safety and isolate a rollback rehearsal on a copy. Ensure protected local profiles and old installed state recover.
- Choose a quiet window with creator permission; **do not automatically restart** Mr. Mak or disrupt working agents. Install, launch and rerun M1/M2 smoke tests against the installed app, then repeat a short M3 continuity check.
- If regression occurs, restore the original installed build and separately protected **current** state. Historic test-session restoration is optional, not a reason to delay promotion. Record exact PASS/FAIL/NOT RUN rather than declaring installation a success.
- Publish an operations note: how to open the correct Bob conversation, route Ask Bob drafts, start native Codex, recover sessions, find GitHub receipts and back out safely.

**Gate M5:** user-observed installed version, verified restore path, creator signoff. **The old coordination workflow's retirement requires M3/M5 plus the separate producer's audit; nothing here silently authorizes retirement.**

## 4. Authority and operating rules

| Decision/action | Authority |
| --- | --- |
| Scoped code/tests on a candidate branch, no running-worker interference | Named implementation owner, with reviewer and exact-SHA receipt |
| Architectural boundaries, model/auth/security review | Bob integration |
| GitHub task coordination for Wizard 3.5 while Sonnet is unproven | Existing producer-authorized release workflow |
| Bounded **non-production** Sonnet coordinator proof | Named test owner under M3; no production dispatch |
| Change active dispatcher or promote native installed build | Creator go/no-go after independent evidence |
| Public Roblox release, game-engine merges or repins | Owning release authority; **out of scope** |
| Delete sessions/worktrees, share private profiles, send to ChatGPT automatically | **Not authorized by this plan** |

Use one durable issue/PR/commit receipt per task. No second shadow backlog in Mr. Mak. Escalate consequential changes, not routine repairs. Producer Desk can carry decisions, but Mr. Mak-specific implementation evidence stays in this repository and links back to the desk.

## 5. Immediate bounded next actions

1. **Integration owner (Bob):** maintain this plan, review exact-SHA proofs, request a named local Windows executor when the laptop reconnects. Reconcile the existing Claude plan and current branch; document any differences explicitly.
2. **Windows QA / app builder:** perform M0 private backup+restore and M1 native security/UX witness without touching the installed app. Report exact version, screen evidence, negative tests and remaining blockers.
3. **Native agent owner:** verify Codex CLI absence/presence and prepare a contained native installation/proof proposal. Do **not** install or migrate sessions without approval.
4. **Coordinator proof owner:** define disposable M3 task and agent handoff receipts. Do not claim Sonnet ready based on a contract, and do not let M3 hold up 3.5.
5. **After gates:** personalize, rehearse rollback, request creator approval for promotion.

**Explicitly NOT RUN now:** local backup restore of the **current** cockpit state; native GUI/login stress on the exact final build; security/UI operator witness; native Codex; live Sonnet coordinator; installed promotion; retirement. This file is a **plan and accountability baseline**, not proof that these actions happened.
