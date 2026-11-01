// File: desktop/service/test/browser-tabs-api.test.mjs
// Purpose: Browser sessions are stored behind the same authenticated local HTTP API.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { createService } from '../server.mjs';

test('browser-tab HTTP contract is authenticated, durable and independent from CLI chats', async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'mrmak-bob-api-'));
  const repo = path.resolve(import.meta.dirname, '../../..');
  let service;
  const key = 'test-local-bearer-token';
  const api = async (route, method = 'GET', data, authorized = true) => {
    const response = await fetch(service.origin + '/api' + route, {
      method, headers: { ...(authorized ? { Authorization: 'Bearer ' + key } : {}),
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    service = await createService({ repo, uiDir: path.join(repo, 'dist'), stateDir, token: key, restoreSessions: false, native: () => {} });
    assert.equal((await api('/browser-tabs', 'GET', undefined, false)).status, 401);
    const first = await api('/browser-tabs', 'POST', { name: 'Bob Producer Desk', url: 'https://chatgpt.com/c/11111111-1111-4111-8111-111111111111' });
    assert.equal(first.status, 201);
    assert.equal(first.data.type, 'browser');
    const second = await api('/browser-tabs', 'POST', { name: 'Bob Wizard' });
    assert.equal(second.status, 201);
    assert.notEqual(first.data.id, second.data.id);
    assert.equal(service.sessions.active().length, 0, 'no terminal workers launched');
    const draft = await service.coordinator.execute('ask_bob', {
      title: 'Wizard V3.5 decision', question: 'Does PR #85 keep game content out of WorldTools?', sourceChatId: 'wizard',
    });
    assert.equal(draft.status, 'pending');
    assert.equal((await api('/bob-questions')).data.questions.length, 1);
    assert.equal((await api('/bob-questions', 'GET', undefined, false)).status, 401);
    assert.equal('sent' in draft, false);

    assert.equal((await api('/browser-tabs')).data.tabs.length, 2);
    assert.equal((await api('/browser-tabs/' + first.data.id, 'PATCH', { bypass: true })).status, 400);
    const changed = await api('/browser-tabs/' + first.data.id, 'PATCH', { pinned: true, group: 'Studio' });
    assert.equal(changed.status, 200);
    const selected = await api('/browser-tabs/' + first.data.id + '/select', 'POST', {});
    assert.equal(selected.data.selectedId, first.data.id);
    await api('/browser-tabs/' + first.data.id, 'DELETE', {});
    assert.equal((await api('/browser-tabs')).data.tabs.length, 2);
    const unauthorized = await api('/browser-tabs', 'POST', { name: 'Evil' }, false);
    assert.equal(unauthorized.status, 401);
    await service.close(); service = null;
    service = await createService({ repo, uiDir: path.join(repo, 'dist'), stateDir, token: key, restoreSessions: false, native: () => {} });
    const restored = (await api('/browser-tabs')).data;
    assert.equal(restored.tabs.length, 2);
    assert.equal(restored.tabs.find(tab => tab.id === first.data.id).open, false);
    assert.equal(restored.tabs.find(tab => tab.id === second.data.id).open, true);
    assert.equal(restored.tabs.find(tab => tab.id === first.data.id).group, 'Studio');
    assert.equal((await api('/bob-questions')).data.questions.length, 1, 'review queue persists independently');
    assert.equal((await api('/bob-questions/' + draft.id + '/dismiss', 'POST', {})).status, 200);
    assert.equal((await api('/bob-questions')).data.questions.length, 0);

    assert.equal(service.sessions.active().length, 0);
  } finally {
    if (service) await service.close();
    await rm(stateDir, { recursive: true, force: true });
  }
});
