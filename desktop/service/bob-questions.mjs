// File: desktop/service/bob-questions.mjs
// Version: V01
// Purpose: Coordinator-to-Bob review queue. These are drafts, never auto-sent messages.
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJson, saveJson } from './util.mjs';

function invalid(message) { return Object.assign(new Error(message), { status: 400 }); }
function text(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw invalid('Choose a valid ' + label + '.');
  return value.trim();
}
export class BobQuestions {
  constructor(stateDir, changed = () => {}) {
    this.file = path.join(stateDir, 'bob-questions.json');
    this.changed = changed;
    this.items = [];
    this.queue = Promise.resolve();
  }
  async init() {
    const saved = await readJson(this.file, []);
    this.items = (Array.isArray(saved) ? saved : []).filter(item =>
      typeof item?.id === 'string' && typeof item?.title === 'string' && typeof item?.question === 'string' &&
      ['pending', 'dismissed'].includes(item.status)).slice(-100);
    return this;
  }
  list({ includeDismissed = false } = {}) {
    return this.items.filter(item => includeDismissed || item.status === 'pending').map(item => ({ ...item }));
  }
  transact(change) {
    const pending = this.queue.catch(() => {}).then(async () => {
      const result = change();
      await saveJson(this.file, this.items.slice(-100));
      this.changed({ questions: this.list() });
      return result;
    });
    this.queue = pending;
    return pending;
  }
  create(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['title', 'question', 'sourceChatId'].includes(key))) throw invalid('Unsupported Bob question.');
    const title = text(input.title, 100, 'question title');
    const question = text(input.question, 12000, 'question body');
    const sourceChatId = input.sourceChatId == null ? null : text(input.sourceChatId, 128, 'source ID');
    return this.transact(() => {
      const item = { id: randomUUID(), title, question, sourceChatId, status: 'pending', createdAt: new Date().toISOString() };
      this.items.push(item);
      this.items = this.items.slice(-100);
      return { ...item };
    });
  }
  dismiss(id) {
    return this.transact(() => {
      const item = this.items.find(item => item.id === id);
      if (!item) throw Object.assign(new Error('Bob question not found.'), { status: 404 });
      item.status = 'dismissed';
      return { ...item };
    });
  }
}
