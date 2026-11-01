// File: desktop/service/browser-tabs.mjs
// Version: V01
// Purpose: Durable, origin-limited browser conversations. Never spawn terminal agents.
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJson, saveJson } from './util.mjs';

export const CHATGPT_HOME = 'https://chatgpt.com/';
const CHAT_ID = '[a-zA-Z0-9_-]{8,100}';
const CHAT_PATH = new RegExp('^/c/' + CHAT_ID + '$');
const PROJECT_CHAT_PATH = new RegExp('^/g/' + CHAT_ID + '/c/' + CHAT_ID + '$');
const MAX_BROWSER_TABS = 32;

function invalid(message) { return Object.assign(new Error(message), { status: 400 }); }

export function chatgptUrl(value = CHATGPT_HOME) {
  if (typeof value !== 'string' || !value || value.length > 350) throw invalid('Choose a ChatGPT conversation URL.');
  let url;
  try { url = new URL(value); } catch { throw invalid('Choose a valid ChatGPT conversation URL.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'chatgpt.com' || url.port ||
      url.username || url.password || url.search || url.hash ||
      !(url.pathname === '/' || CHAT_PATH.test(url.pathname) || PROJECT_CHAT_PATH.test(url.pathname))) {
    throw invalid('Only chatgpt.com home and conversation links are supported.');
  }
  return url.origin + url.pathname;
}

function shortName(value, fallback = 'Bob') {
  if (value == null) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > 100 || /[\x00-\x1f\x7f]/.test(value)) {
    throw invalid('Choose a short name for the Bob tab.');
  }
  return value.trim();
}
function groupName(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 60 || !value.trim() || /[\x00-\x1f\x7f]/.test(value)) throw invalid('Choose a valid group.');
  return value.trim();
}
function snapshot(record) { return { ...record }; }

export class BrowserTabs {
  constructor(stateDir, changed = () => {}) {
    this.file = path.join(stateDir, 'browser-tabs.json');
    this.changed = changed;
    this.tabs = [];
    this.selectedId = null;
    this.queue = Promise.resolve();
  }

  async init() {
    const saved = await readJson(this.file, {});
    const ids = new Set();
    for (const entry of Array.isArray(saved?.tabs) ? saved.tabs.slice(0, MAX_BROWSER_TABS) : []) {
      try {
        if (!entry || typeof entry.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(entry.id) || ids.has(entry.id)) continue;
        const item = {
          id: entry.id, type: 'browser', provider: 'chatgpt', name: shortName(entry.name),
          url: chatgptUrl(entry.url), pinned: entry.pinned === true,
          group: groupName(entry.group), tabOrder: Number.isSafeInteger(entry.tabOrder) && entry.tabOrder >= 0 ? entry.tabOrder : this.tabs.length,
          open: entry.open === true, createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
          updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString(),
        };
        ids.add(item.id); this.tabs.push(item);
      } catch { /* Invalid saved entries cannot launch arbitrary remote sites. */ }
    }
    this.selectedId = this.tabs.some(tab => tab.open && tab.id === saved?.selectedId) ? saved.selectedId : this.tabs.find(tab => tab.open)?.id || null;
    return this;
  }
  list() { return this.tabs.map(snapshot); }
  active() { return this.tabs.filter(item => item.open).map(snapshot); }
  state() { return { tabs: this.list(), selectedId: this.selectedId }; }
  get(id) {
    const item = this.tabs.find(item => item.id === id);
    if (!item) throw Object.assign(new Error('Browser tab not found.'), { status: 404 });
    return item;
  }
  transact(change) {
    const operation = this.queue.catch(() => {}).then(async () => {
      const result = change();
      await saveJson(this.file, this.state());
      this.changed(this.state());
      return result;
    });
    this.queue = operation;
    return operation;
  }
  create({ url = CHATGPT_HOME, name = 'Bob', group = null } = {}) {
    // Validate before queueing; no URL reaches the native side unchecked.
    url = chatgptUrl(url); name = shortName(name); group = groupName(group);
    return this.transact(() => {
      if (this.tabs.filter(tab => tab.open).length >= MAX_BROWSER_TABS) throw invalid('Close a Bob tab before opening another.');
      const now = new Date().toISOString();
      const item = { id: randomUUID(), type: 'browser', provider: 'chatgpt', name, url, pinned: false, group,
        tabOrder: Math.max(-1, ...this.tabs.map(tab => tab.tabOrder)) + 1, open: true, createdAt: now, updatedAt: now };
      this.tabs.push(item); this.selectedId = item.id;
      return snapshot(item);
    });
  }
  patch(id, data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !['url', 'name', 'pinned', 'group', 'tabOrder'].includes(key))) throw invalid('Unsupported browser-tab change.');
    const updates = {};
    if ('url' in data) updates.url = chatgptUrl(data.url);
    if ('name' in data) updates.name = shortName(data.name);
    if ('pinned' in data) { if (typeof data.pinned !== 'boolean') throw invalid('Invalid pin value.'); updates.pinned = data.pinned; }
    if ('group' in data) updates.group = groupName(data.group);
    if ('tabOrder' in data) { if (!Number.isSafeInteger(data.tabOrder) || data.tabOrder < 0 || data.tabOrder > 10000) throw invalid('Invalid tab order.'); updates.tabOrder = data.tabOrder; }
    return this.transact(() => {
      const item = this.get(id);
      Object.assign(item, updates, { updatedAt: new Date().toISOString() });
      return snapshot(item);
    });
  }
  select(id) {
    return this.transact(() => {
      if (!this.get(id).open) throw invalid('Open the browser tab first.');
      this.selectedId = id;
      return this.state();
    });
  }
  close(id) {
    return this.transact(() => {
      const item = this.get(id); item.open = false; item.updatedAt = new Date().toISOString();
      if (this.selectedId === id) this.selectedId = this.tabs.find(tab => tab.open)?.id || null;
      return snapshot(item);
    });
  }
  reopen(id) {
    return this.transact(() => {
      if (this.tabs.filter(tab => tab.open).length >= MAX_BROWSER_TABS) throw invalid('Close a Bob tab before opening another.');
      const item = this.get(id); item.open = true; item.updatedAt = new Date().toISOString(); this.selectedId = id;
      return snapshot(item);
    });
  }
}
