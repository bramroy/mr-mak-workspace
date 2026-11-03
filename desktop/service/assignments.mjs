import { randomUUID } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { readJson, saveJson } from './util.mjs';
import { verifyReceipt, fingerprint } from './test-receipts.mjs';

// The coordinator's durable record of who owns what. GitHub stays the source of truth: every receipt and verdict
// carries the commit and link a person can open, and this file only remembers them across a restart or a hand-over.
export const RESULTS = ['PASS', 'FAIL', 'NOT RUN'];
const SHA = /^[0-9a-f]{7,40}$/i;
export const normalizeResult = value => {
  const text = String(value ?? '').trim().toUpperCase().replace(/[_-]/g, ' ');
  if (text === 'SKIPPED' || text === 'SKIP') return 'NOT RUN'; // A skip is never a pass.
  if (!RESULTS.includes(text)) throw new Error('A result is PASS, FAIL or NOT RUN.');
  return text;
};

// GitHub is the source of truth for checks. A model's report is a claim; the check runs on the commit are the evidence.
const CONCLUSION = { success: 'PASS', failure: 'FAIL', timed_out: 'FAIL', cancelled: 'FAIL', action_required: 'FAIL', startup_failure: 'FAIL', skipped: 'NOT RUN', neutral: 'NOT RUN', stale: 'NOT RUN' };
export const checkResult = run => run.status && run.status !== 'completed' ? 'NOT RUN' : CONCLUSION[run.conclusion] || 'NOT RUN'; // Queued, running, skipped or unknown: never a pass.
const REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/;
const REPO = { test: value => REPO_PATTERN.test(String(value)) && !['.', '..'].includes(String(value).split('/')[1]) };
export async function githubChecks({ repo, sha, token, fetchImpl = fetch }) {
  if (!REPO.test(String(repo || ''))) throw new Error('The task needs its repository as owner/name to verify checks on GitHub.');
  if (!token) throw new Error('No GitHub token: set GITHUB_TOKEN in .env so receipts can be verified against GitHub.');
  const response = await fetchImpl(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(sha)}/check-runs?per_page=100`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!response.ok) throw new Error(`GitHub did not return the checks for ${repo}@${String(sha).slice(0, 8)} (HTTP ${response.status}).`);
  const data = await response.json();
  const runs = Array.isArray(data.check_runs) ? data.check_runs : [];
  if (!runs.length) throw new Error(`GitHub has no check runs for ${repo}@${String(sha).slice(0, 8)}. No checks is not a pass.`);
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  return Promise.all(runs.map(async run => {
    let executed = executedTests(run);
    // Actions jobs leave a check run's own output empty; a step publishes the count as an annotation (scripts/emit-test-count.mjs).
    if (executed == null && run.id && run.output?.annotations_count > 0) {
      try {
        const notes = await fetchImpl(`https://api.github.com/repos/${repo}/check-runs/${run.id}/annotations?per_page=50`, { headers });
        if (notes.ok) executed = executedTests({ output: { text: (await notes.json()).map(note => `${note.title || ''} ${note.message || ''}`).join('\n') } });
      } catch { /* No count is no evidence. */ }
    }
    return { name: String(run.name), result: checkResult(run), executed, url: run.html_url || null };
  }));
}

// A green check run only says the job exited cleanly. It does not say the tests ran: a job that skips its suite is green too.
// The evidence is the passed-test count the run itself reports (node:test "# pass N", "N passed", "N passing"). No count is no evidence.
export const executedTests = run => {
  const out = run.output || {};
  const text = [out.title, out.summary, out.text].filter(Boolean).join('\n');
  const found = [];
  for (const pattern of [/#\s*pass\s+(\d+)/gi, /(\d+)\s+(?:tests?\s+)?(?:passed|passing)\b/gi, /\bpass(?:ed)?[:=]\s*(\d+)/gi]) for (const match of text.matchAll(pattern)) found.push(Number(match[1]));
  return found.length ? Math.max(...found) : null;
};
// A task names the suites that must have run: a check name, or { name, min } for a floor on the passed-test count.
export const normalizeSuites = list => {
  if (!Array.isArray(list) || !list.length) throw new Error('Name the check runs that must show their tests executed (suites), such as the vendor and service test jobs.');
  return list.map(item => {
    const name = String(typeof item === 'string' ? item : item?.name || '').trim(), min = typeof item === 'object' && item?.min != null ? Number(item.min) : 1;
    if (!name) throw new Error('Every suite needs a check name.');
    if (!Number.isInteger(min) || min < 1) throw new Error('A suite floor is a whole number of at least 1.');
    return { name, min };
  });
};
// A suite counts as PASS only if GitHub says it passed AND it reports at least its floor of passed tests. Missing, or silent about its count, is NOT RUN.
export const applyEvidence = (suites, checks) => {
  const out = checks.map(check => ({ ...check }));
  for (const suite of suites) {
    const check = out.find(item => item.name === suite.name);
    if (!check) { out.push({ name: suite.name, result: 'NOT RUN', executed: null, missing: true, evidence: 'GitHub has no check run with this name.' }); continue; }
    if (check.result !== 'PASS') continue;
    if (!Number.isInteger(check.executed)) { check.result = 'NOT RUN'; check.evidence = 'Green, but the run reports no test count, so it is not evidence the tests ran.'; }
    else if (check.executed < suite.min) { check.result = 'NOT RUN'; check.evidence = `Green, but only ${check.executed} test(s) passed; ${suite.min} are required.`; }
  }
  return out;
};
export const WORKER_KINDS = ['claude', 'codex', 'opencode', 'bob'];
// The cutover proof is fixed text the owner starts. The coordinator model cannot make its own task a proof.
export const proofSpec = ({ id, repo }) => ({
  title: 'Cutover proof',
  intent: 'Prove the coordinator can dispatch, verify and close one disposable task before real work moves to it.',
  taskText: `This is the disposable cutover proof. On a throwaway branch of ${repo}, add one small file named proof/${id}.txt, run the repository's own tests, and report the exact commit. Change nothing else.`,
});

export const DEFAULT_CHARTER = `# Mr. Mak coordinator charter

You are the one dispatcher for the work you assign. GitHub holds the task, the decision and the proof; you hold ownership and the receipts.

- One owner and one dispatcher per task. Never assign a task that another dispatcher holds. Hand a task over only with an acknowledgement.
- Quote the owner's own words as the requirement. A task without them is not ready.
- A receipt names the exact commit, the checks that ran with PASS, FAIL or NOT RUN, and whether a negative test that must fail was seen failing. SKIPPED means NOT RUN.
- The person who wrote the work never gives its verdict. Another chat or person gives it, on the same commit.
- A task closes only on a PASS receipt with a negative case and an independent PASS verdict on the same commit. Anything NOT RUN keeps it open.
- Escalate design, scope, spending, publishing or destructive changes with ask_bob. That is a draft the owner sends.
- Say what you observed, not what you expect.`;

const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
const conflict = message => Object.assign(new Error(message), { status: 409 });

export class Assignments {
  // verify: async ({ repo, sha }) => [{ name, result }] from GitHub. Without it, receipts stay unverified and cannot close a task.
  constructor({ stateDir, dispatcherId = null, verify = null, pid = process.pid, openGates = false }) {
    Object.assign(this, { stateDir, verify, pid, openGates }); // openGates exists for tests of other rules; the service never sets it.
    this.file = path.join(stateDir, 'assignments.json'); this.charterFile = path.join(stateDir, 'coordinator-charter.json'); this.lockFile = path.join(stateDir, 'dispatcher.lock'); this.cutoverFile = path.join(stateDir, 'cutover.json'); this.runnersFile = path.join(stateDir, 'runners.json'); this.suitesFile = path.join(stateDir, 'suites.json'); this.pinned = {}; this.receiptsDir = path.join(stateDir, 'test-receipts'); this.runners = [];
    this.tasks = new Map(); this.dispatcherId = dispatcherId; this.charter = DEFAULT_CHARTER; this.readOnly = null; this.cutover = { approved: null };
  }
  // One process may act as this state directory's dispatcher. A second one reads, and refuses to change anything.
  async acquire() {
    await mkdirp(this.stateDir);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const handle = await open(this.lockFile, 'wx');
        await handle.writeFile(JSON.stringify({ pid: this.pid, dispatcherId: this.dispatcherId, startedAt: new Date().toISOString() })); await handle.close();
        this.readOnly = null; return true;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        let held = null; try { held = JSON.parse(await readFile(this.lockFile, 'utf8')); } catch { /* unreadable lock: treated as stale */ }
        if (held?.pid && held.pid !== this.pid && alive(held.pid)) { this.readOnly = `another Mr. Mak process (pid ${held.pid}) is this state folder's dispatcher`; return false; }
        await unlink(this.lockFile).catch(() => {}); // The holder is gone (or it is this process restarting): take over.
      }
    }
    this.readOnly = 'the dispatcher lock could not be taken'; return false;
  }
  async release() { if (this.readOnly) return; await unlink(this.lockFile).catch(() => {}); }
  writable() { if (this.readOnly) throw conflict(`Read only: ${this.readOnly}. Only one process dispatches for a state folder.`); }
  async init() {
    const data = await readJson(this.file, { tasks: [] });
    for (const task of data.tasks || []) this.tasks.set(task.id, task);
    const charter = await readJson(this.charterFile, null);
    if (charter?.dispatcherId) this.dispatcherId = this.dispatcherId || charter.dispatcherId;
    this.dispatcherId = this.dispatcherId || `dispatcher-${randomUUID().slice(0, 8)}`;
    if (typeof charter?.text === 'string' && charter.text.trim()) this.charter = charter.text;
    this.cutover = { approved: null, ...(await readJson(this.cutoverFile, {})) };
    this.runners = (await readJson(this.runnersFile, { runners: [] })).runners || [];
    this.pinned = (await readJson(this.suitesFile, { suites: {} })).suites || {};
    await this.acquire();
    if (!this.readOnly) await saveJson(this.charterFile, { dispatcherId: this.dispatcherId, text: this.charter });
    return this;
  }
  async save() { this.writable(); await saveJson(this.file, { tasks: [...this.tasks.values()] }); this.onChange?.(); }
  snapshot(identity = null) { const all = [...this.tasks.values()]; return { dispatcher: this.dispatcherId, readOnly: this.readOnly, identity, gates: this.gates(identity), runners: this.runners.map(({ name, role, person, fingerprint: print, at }) => ({ name, role, person, fingerprint: print, at })), pinnedSuites: Object.entries(this.pinned).map(([key, value]) => ({ key, ...value })), charter: this.charter, open: all.filter(task => task.status !== 'closed'), closed: all.filter(task => task.status === 'closed').slice(-20) }; }
  get(id) { const task = this.tasks.get(id); if (!task) throw new Error('Unknown assignment.'); return task; }
  owns(owner) { return this.open().some(task => task.owner === owner && task.dispatcher === this.dispatcherId); }
  open() { return [...this.tasks.values()].filter(task => task.status !== 'closed'); }

  // Cutover from the old dispatcher (Opus) to this Sonnet coordinator. Real work is refused until all three hold.
  gates(identity, kind = null) {
    const model = identity?.observed || '';
    const proof = [...this.tasks.values()].find(task => task.proof && task.status === 'closed');
    const worker = kind && WORKER_KINDS.includes(kind) ? [...this.tasks.values()].find(task => task.proof && task.status === 'closed' && task.workerKind === kind) : null;
    return [
      { name: 'model', ok: identity?.provider === 'claude' && /sonnet/i.test(model), detail: model ? `the running process reports ${model}` : 'no model reported by the running process yet' },
      { name: 'proof', ok: !!proof, detail: proof ? `proof task "${proof.title}" closed with an independent verdict` : 'no proof task has been closed yet' },
      { name: 'owner', ok: !!this.cutover.approved, detail: this.cutover.approved ? `approved by ${this.cutover.approved.by} at ${this.cutover.approved.at}` : 'the owner has not approved the cutover' },
      // Each kind of worker (Claude, Codex, OpenCode, Bob) must itself have closed a proof task, on the same evidence rules, before real work goes to it.
      ...(kind && WORKER_KINDS.includes(kind) ? [{ name: 'worker', ok: !!worker, detail: worker ? `a ${kind} worker closed proof task "${worker.title}"` : `no ${kind} worker has closed a proof task yet` }] : []),
    ];
  }
  ready(identity, kind = null) { return this.gates(identity, kind).every(gate => gate.ok); }
  async approveCutover(by, identity) {
    this.writable();
    const failing = this.gates(identity).filter(gate => gate.name !== 'owner' && !gate.ok);
    if (failing.length) throw conflict(`Cannot approve the cutover yet: ${failing.map(gate => gate.detail).join('; ')}.`);
    this.cutover = { approved: { by: String(by || 'owner'), at: new Date().toISOString() } }; await saveJson(this.cutoverFile, this.cutover); this.onChange?.(); return this.cutover;
  }

  async assign({ id = randomUUID().slice(0, 8), title, intent, taskText, repo, branch, baseSha, owner, link, suites, proof }, { identity = null, workerKind = null } = {}) {
    this.writable();
    if (proof) throw new Error('A proof task is started by the owner from the Coordinator panel, never by the coordinator.');
    if (!this.openGates && !this.ready(identity, workerKind)) throw conflict(`Real work is refused until the cutover gates pass (${this.gates(identity, workerKind).filter(gate => !gate.ok).map(gate => gate.name).join(', ')}). The owner starts a proof task first.`);
    return this.create({ id, title, intent, taskText, repo, branch, baseSha, owner, link, suites }, { proof: false, workerKind });
  }
  // The owner's act, with a fixed task text. Always allowed, so the first proof can run before anything else is.
  async startProof({ id = randomUUID().slice(0, 8), owner, repo, suites }, { workerKind = null } = {}) {
    this.writable();
    if (!REPO.test(String(repo || ''))) throw new Error('Name the repository for the proof as owner/name.');
    return this.create({ id, ...proofSpec({ id, repo }), owner, repo, suites }, { proof: true, workerKind });
  }
  async create({ id, title, intent, taskText, repo, branch, baseSha, owner, link, suites }, { proof, workerKind }) {
    if (!String(title || '').trim()) throw new Error('Give the task a short title.');
    if (!String(intent || '').trim()) throw new Error("Quote the owner's own words as the requirement before assigning.");
    if (!String(taskText || '').trim()) throw new Error('Give the task text the worker will be sent. It is kept as the original task, apart from any later message.');
    if (!String(owner || '').trim()) throw new Error('Name the one owner (a chat or a person).');
    if (baseSha != null && !SHA.test(baseSha)) throw new Error('The base commit must be a hexadecimal commit ID.');
    if (repo != null && !REPO.test(repo)) throw new Error('Name the repository as owner/name.');
    const checked = normalizeSuites(suites);
    if (!repo) throw new Error('Name the repository as owner/name: the suites are verified on GitHub.');
    const existing = this.tasks.get(id);
    if (existing) {
      if (existing.status !== 'closed' && existing.dispatcher !== this.dispatcherId) throw conflict(`Another dispatcher (${existing.dispatcher}) holds this task.`);
      throw conflict('This assignment already exists; record receipts on it or close it.');
    }
    const task = { id, title: title.trim(), intent: intent.trim(), taskText: taskText.trim().slice(0, 6000), repo, branch: branch || null, baseSha: baseSha || null, owner: owner.trim(), workerKind: workerKind || 'person', suites: checked, link: link || null, proof, dispatcher: this.dispatcherId, status: 'assigned', receipts: [], verdicts: [], handoff: null, created: new Date().toISOString() };
    this.tasks.set(id, task); await this.save(); return task;
  }
  // The owner registers a runner's public key and role. The coordinator has no tool for this.
  async registerRunner({ name, role, person, publicKeyPem }) {
    this.writable();
    if (!String(person || '').trim()) throw new Error('Name the person this runner key belongs to. The author and the reviewer must be different people.');
    if (!String(name || '').trim()) throw new Error('Name the runner.');
    if (!['author', 'reviewer'].includes(role)) throw new Error('A runner is an author or a reviewer.');
    let print; try { print = fingerprint(String(publicKeyPem)); } catch { throw new Error('That is not a public key.'); }
    if (this.runners.some(runner => runner.fingerprint === print)) throw conflict('That key is already registered.');
    this.runners.push({ name: name.trim(), role, person: person.trim(), publicKeyPem: String(publicKeyPem), fingerprint: print, at: new Date().toISOString() });
    await saveJson(this.runnersFile, { runners: this.runners }); this.onChange?.(); return { name: name.trim(), role, person: person.trim(), fingerprint: print };
  }
  // The owner pins the exact command that proves a suite for a repository. A receipt for any other command is refused: `echo "# pass 99"` is not a test run.
  async pinSuite({ repo, suite, command }) {
    this.writable();
    if (!REPO.test(String(repo || ''))) throw new Error('Name the repository as owner/name.');
    if (!String(suite || '').trim() || !String(command || '').trim()) throw new Error('Give the suite name and the exact test command.');
    this.pinned[`${repo}|${suite.trim()}`] = { repo, suite: suite.trim(), command: command.trim(), at: new Date().toISOString() };
    await saveJson(this.suitesFile, { suites: this.pinned }); this.onChange?.(); return this.pinned[`${repo}|${suite.trim()}`];
  }
  pinnedCommand(repo, suite) { return this.pinned[`${repo}|${suite}`]?.command || null; }
  // A signed local test receipt for one of the task's suites. Rejected unless it re-verifies from scratch.
  async localReceipt(id, receipt) {
    const task = this.get(id); this.held(task);
    const suite = (task.suites || []).find(item => item.name === receipt?.payload?.suite);
    if (!suite) throw new Error(`The receipt is for suite "${receipt?.payload?.suite}", which is not one of this task's suites (${(task.suites || []).map(item => item.name).join(', ')}).`);
    const command = this.pinnedCommand(task.repo, suite.name);
    if (!command) throw new Error(`The owner has not pinned the test command for "${suite.name}" in ${task.repo}, so a local receipt cannot count. Pin it in the Coordinator panel.`);
    const result = verifyReceipt(receipt, { runners: this.runners, expect: { repo: task.repo, suite: suite.name, command } });
    if (!result.ok) throw new Error(`Test receipt rejected: ${result.reasons.join(' ')}`);
    const { mkdir } = await import('node:fs/promises'); await mkdir(this.receiptsDir, { recursive: true });
    const file = `${task.id}-${suite.name.replace(/[^A-Za-z0-9_.-]/g, '_')}-${receipt.payload.sha.slice(0, 8)}-${result.runner.fingerprint.slice(0, 8)}.json`;
    await saveJson(path.join(this.receiptsDir, file), receipt);
    task.localReceipts = (task.localReceipts || []).filter(item => item.file !== file);
    task.localReceipts.push({ file, suite: suite.name, sha: receipt.payload.sha.toLowerCase(), runner: result.runner.name, role: result.runner.role, fingerprint: result.runner.fingerprint, counts: result.counts, command: receipt.payload.command, at: new Date().toISOString() });
    await this.save(); return task.localReceipts[task.localReceipts.length - 1];
  }
  // A suite is evidenced locally when an author runner and a different reviewer runner, both registered, each signed a passing run of
  // this commit with at least the floor of passed tests. The stored receipts are re-verified now, so a key removed or a file edited fails.
  async localStatus(task, suite, sha) {
    const good = [];
    for (const item of (task.localReceipts || []).filter(entry => entry.suite === suite.name && entry.sha === String(sha).toLowerCase())) {
      const receipt = await readJson(path.join(this.receiptsDir, item.file), null);
      const command = this.pinnedCommand(task.repo, suite.name);
      const result = receipt && command && verifyReceipt(receipt, { runners: this.runners, expect: { repo: task.repo, suite: suite.name, command } });
      if (result?.ok && result.counts.pass >= suite.min && String(receipt.payload.sha).toLowerCase() === String(sha).toLowerCase()) good.push(result.runner);
    }
    const author = good.find(runner => runner.role === 'author'), reviewer = good.find(runner => runner.role === 'reviewer' && author && runner.fingerprint !== author.fingerprint && runner.person.toLowerCase() !== author.person.toLowerCase());
    if (author && reviewer) return { ok: true, detail: `signed passing runs by ${author.name} (${author.person}) and ${reviewer.name} (${reviewer.person})` };
    return { ok: false, detail: good.length ? `only ${[...new Set(good.map(runner => `${runner.name} (${runner.role})`))].join(', ')} signed a passing run; an author and a reviewer who is a different person are both needed` : 'no verified signed local run of this commit' };
  }
  held(task) { this.writable(); if (task.status === 'closed') throw new Error('This assignment is closed.'); if (task.dispatcher !== this.dispatcherId) throw conflict(`Another dispatcher (${task.dispatcher}) holds this task.`); }

  // The coordinator sent something to the owning chat. The first send starts the clock; the saved task text is never replaced by a later message.
  async markDispatched(owner, now = Date.now()) {
    const task = this.open().find(item => item.owner === owner && item.dispatcher === this.dispatcherId);
    if (!task || this.readOnly) return null;
    const at = new Date(now).toISOString();
    task.dispatch = task.dispatch ? { ...task.dispatch, lastSentAt: at, followups: (task.dispatch.followups || 0) + 1 } : { at, redispatches: 0, followups: 0 };
    task.stalled = null; await this.save(); return task;
  }
  async noteRedispatch(id, reason, now = Date.now()) {
    const task = this.get(id); this.held(task);
    task.dispatch = { ...task.dispatch, redispatches: (task.dispatch?.redispatches || 0) + 1, lastRedispatchAt: new Date(now).toISOString(), lastReason: reason }; await this.save(); return task;
  }
  async noteStalled(id, reason) { this.writable(); const task = this.get(id); task.stalled = { reason, at: new Date().toISOString() }; await this.save(); return task; }

  async receipt(id, { sha, link, checks, negativeSeenFailing, note }) {
    const task = this.get(id); this.held(task);
    if (!SHA.test(String(sha || ''))) throw new Error('A receipt needs the exact commit ID.');
    if (!Array.isArray(checks) || !checks.length) throw new Error('List the checks that ran, each with PASS, FAIL or NOT RUN.');
    const reported = checks.map(check => ({ name: String(check?.name || '').trim(), result: normalizeResult(check?.result) }));
    if (reported.some(check => !check.name)) throw new Error('Every check needs a name.');
    // The model's list is a claim. What counts is what GitHub says about this commit.
    let github = null, verifyError = null;
    if (this.verify && task.repo) { try { github = await this.verify({ repo: task.repo, sha }); } catch (error) { verifyError = error.message; } }
    else verifyError = task.repo ? 'No GitHub verifier is configured (set GITHUB_TOKEN in .env).' : 'The task has no repository, so its checks cannot be verified on GitHub.';
    if (github) github = applyEvidence(task.suites || [], github);
    const disagreements = github ? reported.filter(claim => { const real = github.find(run => run.name === claim.name); return !real || real.result !== claim.result; }).map(claim => ({ name: claim.name, reported: claim.result, github: (run => run && !run.missing ? run.result : 'NOT FOUND')(github.find(item => item.name === claim.name)) })) : [];
    const receipt = { sha: sha.toLowerCase(), link: link || null, checks: github || reported, reported, verified: !!github, verifyError, disagreements, negativeSeenFailing: negativeSeenFailing === true, note: note || null, at: new Date().toISOString() };
    task.receipts.push(receipt); task.status = 'receipted'; task.stalled = null; await this.save(); return receipt;
  }
  async verdict(id, { verifier, sha, result, note }) {
    const task = this.get(id); this.held(task);
    if (!String(verifier || '').trim()) throw new Error('Name who gave the verdict.');
    if (String(verifier).trim().toLowerCase() === task.owner.toLowerCase()) throw new Error('The owner of the work cannot give its verdict. Ask someone else.');
    if (!SHA.test(String(sha || ''))) throw new Error('A verdict needs the exact commit ID it judged.');
    const verdict = { verifier: verifier.trim(), sha: sha.toLowerCase(), result: normalizeResult(result), note: note || null, at: new Date().toISOString() };
    task.verdicts.push(verdict); task.status = 'verified'; await this.save(); return verdict;
  }
  async close(id) {
    const task = this.get(id); this.held(task);
    const receipt = task.receipts[task.receipts.length - 1];
    if (!receipt) throw new Error('Cannot close: no receipt yet.');
    const checks = receipt.verified ? receipt.checks : [];
    const names = new Set((task.suites || []).map(suite => suite.name));
    const notPassed = 'Cannot close: a check is FAIL or NOT RUN on GitHub. NOT RUN is not a pass.';
    const failed = checks.find(check => check.result === 'FAIL');
    if (failed) throw new Error(`${notPassed} (${failed.name} failed.)`);
    // Each suite needs evidence its tests ran: GitHub's passed-test count, or signed local runs by an author and a different reviewer.
    const local = await Promise.all((task.suites || []).map(async suite => ({ suite, check: checks.find(check => check.name === suite.name), local: await this.localStatus(task, suite, receipt.sha) })));
    const missing = local.filter(item => item.check?.result !== 'PASS' && !item.local.ok);
    if (missing.length) {
      if (!receipt.verified && !(task.localReceipts || []).some(entry => entry.sha === receipt.sha)) throw new Error(`Cannot close: the receipt is not verified against GitHub (${receipt.verifyError || 'no GitHub result'}) and no suite has signed local runs. A model's report is not evidence.`);
      throw new Error(`${notPassed} No evidence the tests ran for ${missing.map(item => `${item.suite.name} (GitHub: ${item.check?.evidence || item.check?.result || 'no check run'}; local: ${item.local.detail})`).join('; ')}.`);
    }
    if (checks.some(check => !names.has(check.name) && check.result !== 'PASS')) throw new Error(notPassed);
    if (!receipt.negativeSeenFailing) throw new Error('Cannot close: no negative case was seen failing.');
    const verdict = task.verdicts.filter(item => item.sha === receipt.sha).slice(-1)[0];
    if (!verdict) throw new Error('Cannot close: no independent verdict on the receipt commit.');
    if (verdict.result !== 'PASS') throw new Error(`Cannot close: the independent verdict is ${verdict.result}.`);
    task.status = 'closed'; task.closed = new Date().toISOString(); await this.save(); return task;
  }
  // Hand-over: the holder names the successor; only that successor can accept, and it records its first receipt after.
  async handoff(id, to) {
    const task = this.get(id); this.held(task);
    if (!String(to || '').trim() || to === this.dispatcherId) throw new Error('Name a different dispatcher to hand this to.');
    task.handoff = { to: to.trim(), from: this.dispatcherId, at: new Date().toISOString() }; await this.save(); return task;
  }
  async accept(id) {
    this.writable();
    const task = this.get(id);
    if (task.status === 'closed') throw new Error('This assignment is closed.');
    if (!task.handoff || task.handoff.to !== this.dispatcherId) throw conflict('This task was not handed to this dispatcher.');
    task.dispatcher = this.dispatcherId; task.handoff = { ...task.handoff, accepted: new Date().toISOString() }; await this.save(); return task;
  }
  // What a new or restarted coordinator reads first, so state, charter and ownership survive it.
  orientation(identity = null) {
    const rows = this.open().map(task => `- ${task.id} [${task.status}${task.proof ? ', proof' : ''}, ${task.workerKind || 'person'}] ${task.title}: owner ${task.owner}; dispatcher ${task.dispatcher}${task.dispatcher === this.dispatcherId ? ' (you)' : ''}; requirement: "${task.intent}"; receipts ${task.receipts.length}, verdicts ${task.verdicts.length}${task.handoff && !task.handoff.accepted ? `; handing to ${task.handoff.to}` : ''}`);
    const gates = this.gates(identity).map(gate => `${gate.ok ? 'PASS' : 'NOT YET'} ${gate.name}: ${gate.detail}`).join('\n');
    return `Coordinator charter (you are ${this.dispatcherId}${this.readOnly ? `; READ ONLY: ${this.readOnly}` : ''}):\n${this.charter}\n\nCutover gates (real work is refused until all pass; a proof task is always allowed):\n${gates}\n\nOpen assignments:\n${rows.length ? rows.join('\n') : '- none'}`;
  }
}
async function mkdirp(dir) { const { mkdir } = await import('node:fs/promises'); await mkdir(dir, { recursive: true }); }
