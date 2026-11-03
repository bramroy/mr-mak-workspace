import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readJson, saveJson } from './util.mjs';

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

export const DEFAULT_CHARTER = `# Mr. Mak coordinator charter

You are the one dispatcher for the work you assign. GitHub holds the task, the decision and the proof; you hold ownership and the receipts.

- One owner and one dispatcher per task. Never assign a task that another dispatcher holds. Hand a task over only with an acknowledgement.
- Quote the owner's own words as the requirement. A task without them is not ready.
- A receipt names the exact commit, the checks that ran with PASS, FAIL or NOT RUN, and whether a negative test that must fail was seen failing. SKIPPED means NOT RUN.
- The person who wrote the work never gives its verdict. Another chat or person gives it, on the same commit.
- A task closes only on a PASS receipt with a negative case and an independent PASS verdict on the same commit. Anything NOT RUN keeps it open.
- Escalate design, scope, spending, publishing or destructive changes with ask_bob. That is a draft the owner sends.
- Say what you observed, not what you expect.`;

export class Assignments {
  constructor({ stateDir, dispatcherId = null }) { this.file = path.join(stateDir, 'assignments.json'); this.charterFile = path.join(stateDir, 'coordinator-charter.json'); this.tasks = new Map(); this.dispatcherId = dispatcherId; this.charter = DEFAULT_CHARTER; }
  async init() {
    const data = await readJson(this.file, { tasks: [] });
    for (const task of data.tasks || []) this.tasks.set(task.id, task);
    const charter = await readJson(this.charterFile, null);
    if (charter?.dispatcherId) this.dispatcherId = this.dispatcherId || charter.dispatcherId;
    this.dispatcherId = this.dispatcherId || `dispatcher-${randomUUID().slice(0, 8)}`;
    if (typeof charter?.text === 'string' && charter.text.trim()) this.charter = charter.text;
    await saveJson(this.charterFile, { dispatcherId: this.dispatcherId, text: this.charter });
    return this;
  }
  save() { return saveJson(this.file, { tasks: [...this.tasks.values()] }); }
  get(id) { const task = this.tasks.get(id); if (!task) throw new Error('Unknown assignment.'); return task; }
  open() { return [...this.tasks.values()].filter(task => task.status !== 'closed'); }
  async assign({ id = randomUUID().slice(0, 8), title, intent, repo, branch, baseSha, owner, link }) {
    if (!String(title || '').trim()) throw new Error('Give the task a short title.');
    if (!String(intent || '').trim()) throw new Error("Quote the owner's own words as the requirement before assigning.");
    if (!String(owner || '').trim()) throw new Error('Name the one owner (a chat or a person).');
    if (baseSha != null && !SHA.test(baseSha)) throw new Error('The base commit must be a hexadecimal commit ID.');
    const existing = this.tasks.get(id);
    if (existing) {
      if (existing.status !== 'closed' && existing.dispatcher !== this.dispatcherId) throw Object.assign(new Error(`Another dispatcher (${existing.dispatcher}) holds this task.`), { status: 409 });
      throw Object.assign(new Error('This assignment already exists; record receipts on it or close it.'), { status: 409 });
    }
    const task = { id, title: title.trim(), intent: intent.trim(), repo: repo || null, branch: branch || null, baseSha: baseSha || null, owner: owner.trim(), link: link || null, dispatcher: this.dispatcherId, status: 'assigned', receipts: [], verdicts: [], handoff: null, created: new Date().toISOString() };
    this.tasks.set(id, task); await this.save(); return task;
  }
  held(task) { if (task.status === 'closed') throw new Error('This assignment is closed.'); if (task.dispatcher !== this.dispatcherId) throw Object.assign(new Error(`Another dispatcher (${task.dispatcher}) holds this task.`), { status: 409 }); }
  async receipt(id, { sha, link, checks, negativeSeenFailing, note }) {
    const task = this.get(id); this.held(task);
    if (!SHA.test(String(sha || ''))) throw new Error('A receipt needs the exact commit ID.');
    if (!Array.isArray(checks) || !checks.length) throw new Error('List the checks that ran, each with PASS, FAIL or NOT RUN.');
    const clean = checks.map(check => ({ name: String(check?.name || '').trim(), result: normalizeResult(check?.result) }));
    if (clean.some(check => !check.name)) throw new Error('Every check needs a name.');
    const receipt = { sha: sha.toLowerCase(), link: link || null, checks: clean, negativeSeenFailing: negativeSeenFailing === true, note: note || null, at: new Date().toISOString() };
    task.receipts.push(receipt); task.status = 'receipted'; await this.save(); return receipt;
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
    const receipt = task.receipts.at(-1);
    if (!receipt) throw new Error('Cannot close: no receipt yet.');
    if (receipt.checks.some(check => check.result !== 'PASS')) throw new Error('Cannot close: a check is FAIL or NOT RUN. NOT RUN is not a pass.');
    if (!receipt.negativeSeenFailing) throw new Error('Cannot close: no negative case was seen failing.');
    const verdict = task.verdicts.filter(item => item.sha === receipt.sha).at(-1);
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
    const task = this.get(id);
    if (task.status === 'closed') throw new Error('This assignment is closed.');
    if (!task.handoff || task.handoff.to !== this.dispatcherId) throw Object.assign(new Error('This task was not handed to this dispatcher.'), { status: 409 });
    task.dispatcher = this.dispatcherId; task.handoff = { ...task.handoff, accepted: new Date().toISOString() }; await this.save(); return task;
  }
  // What a new or restarted coordinator reads first, so state, charter and ownership survive it.
  orientation() {
    const rows = this.open().map(task => `- ${task.id} [${task.status}] ${task.title}: owner ${task.owner}; dispatcher ${task.dispatcher}${task.dispatcher === this.dispatcherId ? ' (you)' : ''}; requirement: "${task.intent}"; receipts ${task.receipts.length}, verdicts ${task.verdicts.length}${task.handoff && !task.handoff.accepted ? `; handing to ${task.handoff.to}` : ''}`);
    return `Coordinator charter (you are ${this.dispatcherId}):\n${this.charter}\n\nOpen assignments:\n${rows.length ? rows.join('\n') : '- none'}`;
  }
}
