// File: desktop/service/test/browser-tabs.test.mjs
// Purpose: Durable multi-Bob sessions remain separate from terminal workers.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { BrowserTabs, CHATGPT_HOME, chatgptUrl } from '../browser-tabs.mjs';

const valid = [
  'https://chatgpt.com/',
  'https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',
  'https://chatgpt.com/g/g-12345678/c/11111111-1111-4111-8111-111111111111',
];
const rejected = [
  'http://chatgpt.com/', 'https://chatgpt.com.evil.example/c/12345678', 'https://evil.example/',
  'javascript:alert(1)', 'https://foo@chatgpt.com/', 'https://chatgpt.com:444/',
  'https://chatgpt.com/?api_key=secret', 'https://chatgpt.com/#fragment',
  'https://chatgpt.com/internal', 'https://chatgpt.com/c/',
  'https://chatgpt.com/c/12345678?token=secret', 'https://auth.openai.com/',
];

test('ChatGPT browser URLs are explicit HTTPS allowlisted conversations, never arbitrary origins', () => {
  for (const value of valid) assert.equal(chatgptUrl(value), value);
  assert.equal(chatgptUrl(), CHATGPT_HOME);
  for (const value of rejected) assert.throws(() => chatgptUrl(value), /ChatGPT|valid|chatgpt\.com/);
});

test('multiple Bob sessions retain independent URLs, names, order, groups and selection across restart', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mrmak-bob-tabs-'));
  const changes = [];
  try {
    let registry = await new BrowserTabs(dir, state => changes.push(state)).init();
    const desk = await registry.create({ name: 'Bob — Producer Desk', url: valid[1], group: 'Reviews' });
    const wizard = await registry.create({ name: 'Bob — Wizard' });
    assert.notEqual(desk.id, wizard.id);
    assert.equal(registry.active().length, 2);
    assert.equal(registry.state().selectedId, wizard.id);
    await registry.patch(wizard.id, { name: 'Bob — Wizard v3.5', url: valid[2], pinned: true, tabOrder: 0 });
    await registry.select(desk.id);
    await registry.close(desk.id);
    assert.equal(registry.state().selectedId, wizard.id);
    assert.equal(registry.list().length, 2, 'closed tabs are retained in History');
    registry = await new BrowserTabs(dir).init();
    assert.equal(registry.active().length, 1);
    assert.deepEqual(registry.list().map(item => item.name), ['Bob — Producer Desk', 'Bob — Wizard v3.5']);
    assert.equal(registry.get(wizard.id).url, valid[2]);
    assert.equal(registry.get(wizard.id).pinned, true);
    assert.equal(registry.get(desk.id).group, 'Reviews');
    assert.equal(registry.state().selectedId, wizard.id);
    await registry.reopen(desk.id);
    assert.equal(registry.active().length, 2);
    assert.equal(registry.state().selectedId, desk.id);
    assert.ok(changes.length >= 5, 'registry emits changes for UI synchronization');
    const raw = await readFile(path.join(dir, 'browser-tabs.json'), 'utf8');
    assert.doesNotMatch(raw, /api_key|password|secret/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('tampered saved browser URL is rejected rather than launched', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mrmak-bob-tamper-'));
  try {
    await writeFile(path.join(dir, 'browser-tabs.json'), JSON.stringify({
      selectedId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      tabs: [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Unsafe', url: 'https://evil.example/', open: true }],
    }));
    const registry = await new BrowserTabs(dir).init();
    assert.equal(registry.list().length, 0);
    assert.equal(registry.state().selectedId, null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('browser tab operations cannot mutate native session fields or use non-Bob providers', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mrmak-bob-guards-'));
  try {
    const registry = await new BrowserTabs(dir).init();
    const bob = await registry.create({});
    assert.equal(bob.provider, 'chatgpt');
    assert.equal(bob.type, 'browser');
    assert.equal('cwd' in bob, false);
    assert.equal('bypass' in bob, false);
    assert.equal('process' in bob, false);
    assert.throws(() => registry.patch(bob.id, { bypass: true }), /Unsupported/);
    assert.throws(() => registry.patch(bob.id, { agent: 'shell' }), /Unsupported/);
    assert.throws(() => registry.patch(bob.id, { url: 'https://evil.example/' }), /chatgpt\.com|ChatGPT/);
    assert.equal(registry.get(bob.id).url, CHATGPT_HOME);
    assert.throws(() => registry.get('not-a-tab'), /not found/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
