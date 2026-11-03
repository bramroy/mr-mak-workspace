// The failure this exists to remove: a worker says it is working, or takes the task, and then sits there.
// The coordinator watches the chat that owns each open assignment and re-sends the task by itself. It never answers a
// permission or a question (those go to the owner) and it stops after a few tries and says so instead of looping.
export const WATCH_CHECK_MS = 60_000;
export const DEFAULTS = { quietMs: 4 * 60_000, neverStartedMs: 2 * 60_000, maxRedispatch: 3, cpuActiveMs: 1000 };

const ms = value => { const time = Date.parse(value || ''); return Number.isFinite(time) ? time : 0; };

// One verdict for one task and its owner chat. Pure, so every case is a plain test.
export function assess(task, chat, now = Date.now(), config = DEFAULTS) {
  if (task.status === 'closed' || !task.dispatch) return { action: 'none' };
  if (!chat) return { action: 'escalate', reason: 'its chat is gone' };
  // lastActivityAt is the newest sign of life: terminal output, the agent's own transcript, or its processes using CPU.
  if (chat.agent === 'shell') return { action: 'none' };
  if (chat.status !== 'running') return { action: 'escalate', reason: `its chat is ${chat.status}` };
  if (chat.activity === 'waiting' || chat.attention) return { action: 'escalate', reason: 'it is waiting for an answer or permission only the owner can give' };
  const redispatches = task.dispatch.redispatches || 0;
  const since = Math.max(ms(task.dispatch.at), ms(task.dispatch.lastSentAt), ms(task.dispatch.lastRedispatchAt));
  const lastOutput = ms(chat.lastActivityAt || chat.lastOutputAt), quiet = now - Math.max(lastOutput, since);
  const backoff = 2 ** redispatches; // 1x, 2x, 4x the base wait, so a slow worker is not spammed
  const outputSinceDispatch = lastOutput > since;
  let reason = '';
  if (chat.activity === 'working' && quiet > config.quietMs * backoff) reason = 'it says it is working but shows no sign of life (no output, transcript or process activity)';
  else if (chat.activity !== 'working' && !outputSinceDispatch && quiet > config.neverStartedMs * backoff) reason = 'it never started the task it was sent';
  else if (chat.activity !== 'working' && outputSinceDispatch && task.receipts.length === 0 && quiet > config.quietMs * backoff) reason = 'it went idle without returning a receipt';
  if (!reason) return { action: 'none' };
  if (redispatches >= config.maxRedispatch) return { action: 'escalate', reason: `${reason}, and ${redispatches} re-sends did not help` };
  return { action: 'redispatch', reason };
}

// Always the original task, never the last message the coordinator happened to send.
export const resendText = (task, reason) => `Reminder from the coordinator (${reason}). Continue this task now and reply with what you did, or say plainly what is blocking you.\n\nTask: ${task.title}\n${task.taskText}`;

export class DispatchWatchdog {
  constructor({ assignments, chats, send, notify, cpu = null, native = null, config = DEFAULTS }) { Object.assign(this, { assignments, chats, send, notify, cpu, native, config }); this.timer = null; this.escalated = new Set(); this.running = false; this.cpuSeen = new Map(); this.cpuActive = new Map(); }
  // Newest sign of life for a chat: output, its agent transcript, or CPU use by the agent and what it started.
  async lastActivity(chat, now) {
    let latest = Date.parse(chat.lastOutputAt || '') || 0;
    const native = Date.parse(this.native?.(chat.id) || '') || 0; if (native > latest) latest = native;
    const sample = this.cpu ? await Promise.resolve(this.cpu(chat.id)).catch(() => null) : null;
    if (typeof sample === 'number') {
      const before = this.cpuSeen.get(chat.id);
      if (before != null && sample - before >= this.config.cpuActiveMs) this.cpuActive.set(chat.id, now);
      this.cpuSeen.set(chat.id, sample);
    }
    return Math.max(latest, this.cpuActive.get(chat.id) || 0);
  }
  start() { if (!this.timer) { this.timer = setInterval(() => void this.check().catch(() => {}), WATCH_CHECK_MS); this.timer.unref?.(); } }
  close() { clearInterval(this.timer); this.timer = null; }
  async check(now = Date.now()) {
    if (this.running) return [];
    if (this.assignments.readOnly) return [];
    this.running = true; const done = [];
    try {
      const chats = new Map(this.chats().map(chat => [chat.id, chat]));
      for (const task of this.assignments.open()) {
        const own = chats.get(task.owner);
        const seen = own ? { ...own, lastActivityAt: new Date(await this.lastActivity(own, now) || 0).toISOString() } : undefined;
        const verdict = assess(task, seen, now, this.config);
        if (verdict.action === 'redispatch') {
          await this.assignments.noteRedispatch(task.id, verdict.reason, now);
          try { await this.send(task.owner, resendText(task, verdict.reason)); done.push({ id: task.id, action: 'redispatch', reason: verdict.reason }); }
          catch (error) { done.push({ id: task.id, action: 'escalate', reason: `the re-send failed: ${error.message}` }); await this.escalate(task, `the re-send failed: ${error.message}`); }
        } else if (verdict.action === 'escalate') { if (await this.escalate(task, verdict.reason)) done.push({ id: task.id, action: 'escalate', reason: verdict.reason }); }
      }
    } finally { this.running = false; }
    return done;
  }
  async escalate(task, reason) {
    const key = `${task.id}:${reason}`;
    if (this.escalated.has(key)) return false;
    this.escalated.add(key);
    await this.assignments.noteStalled(task.id, reason);
    this.notify?.({ owner: task.owner, title: task.title, text: `Stalled: ${task.title}. ${reason}. This needs you or a different worker.` });
    return true;
  }
}
