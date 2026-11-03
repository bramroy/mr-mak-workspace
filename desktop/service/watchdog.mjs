// The failure this exists to remove: a worker says it is working, or takes the task, and then sits there.
// The coordinator watches the chat that owns each open assignment and re-sends the task by itself. It never answers a
// permission or a question (those go to the owner) and it stops after a few tries and says so instead of looping.
export const WATCH_CHECK_MS = 60_000;
export const DEFAULTS = { quietMs: 4 * 60_000, neverStartedMs: 2 * 60_000, maxRedispatch: 3 };

const ms = value => { const time = Date.parse(value || ''); return Number.isFinite(time) ? time : 0; };

// One verdict for one task and its owner chat. Pure, so every case is a plain test.
export function assess(task, chat, now = Date.now(), config = DEFAULTS) {
  if (task.status === 'closed' || !task.dispatch) return { action: 'none' };
  if (!chat) return { action: 'escalate', reason: 'its chat is gone' };
  if (chat.agent === 'shell') return { action: 'none' };
  if (chat.status !== 'running') return { action: 'escalate', reason: `its chat is ${chat.status}` };
  if (chat.activity === 'waiting' || chat.attention) return { action: 'escalate', reason: 'it is waiting for an answer or permission only the owner can give' };
  const redispatches = task.dispatch.redispatches || 0;
  const since = Math.max(ms(task.dispatch.at), ms(task.dispatch.lastRedispatchAt));
  const lastOutput = ms(chat.lastOutputAt), quiet = now - Math.max(lastOutput, since);
  const backoff = 2 ** redispatches; // 1x, 2x, 4x the base wait, so a slow worker is not spammed
  const outputSinceDispatch = lastOutput > since;
  let reason = '';
  if (chat.activity === 'working' && quiet > config.quietMs * backoff) reason = 'it says it is working but has written nothing';
  else if (chat.activity !== 'working' && !outputSinceDispatch && quiet > config.neverStartedMs * backoff) reason = 'it never started the task it was sent';
  else if (chat.activity !== 'working' && outputSinceDispatch && task.receipts.length === 0 && quiet > config.quietMs * backoff) reason = 'it went idle without returning a receipt';
  if (!reason) return { action: 'none' };
  if (redispatches >= config.maxRedispatch) return { action: 'escalate', reason: `${reason}, and ${redispatches} re-sends did not help` };
  return { action: 'redispatch', reason };
}

export const resendText = (task, reason) => `Reminder from the coordinator (${reason}). Continue this task now and reply with what you did, or say plainly what is blocking you.\n\nTask: ${task.title}\n${task.dispatch.text}`;

export class DispatchWatchdog {
  constructor({ assignments, chats, send, notify, config = DEFAULTS }) { Object.assign(this, { assignments, chats, send, notify, config }); this.timer = null; this.escalated = new Set(); this.running = false; }
  start() { if (!this.timer) { this.timer = setInterval(() => void this.check().catch(() => {}), WATCH_CHECK_MS); this.timer.unref?.(); } }
  close() { clearInterval(this.timer); this.timer = null; }
  async check(now = Date.now()) {
    if (this.running) return [];
    this.running = true; const done = [];
    try {
      const chats = new Map(this.chats().map(chat => [chat.id, chat]));
      for (const task of this.assignments.open()) {
        const verdict = assess(task, chats.get(task.owner), now, this.config);
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
