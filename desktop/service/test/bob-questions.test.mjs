// File: desktop/service/test/bob-questions.test.mjs
// Purpose: Coordinator can queue Bob requests without automatically contacting ChatGPT.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { BobQuestions } from '../bob-questions.mjs';
import { coordinatorTools } from '../coordinator.mjs';

test('coordinator declares a draft-only Ask Bob tool with no remote ChatGPT capability', () => {
  const item = coordinatorTools.find(tool => tool.name === 'ask_bob');
  assert.ok(item);
  assert.match(item.description, /DRAFT ONLY/);
  assert.deepEqual(item.inputSchema.required, ['title', 'question']);
});

test('review requests persist, can be dismissed and never imply delivery to ChatGPT', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mrmak-bob-questions-'));
  try {
    let store = await new BobQuestions(dir).init();
    const item = await store.create({
      title: 'Wizard structure integration review',
      question: 'Review the Fairytale shop entrance contract in PR #85 before engine merge.',
      sourceChatId: 'wizard-agent',
    });
    assert.equal(item.status, 'pending');
    assert.equal('sent' in item, false);
    assert.equal(store.list().length, 1);
    assert.throws(() => store.create({ title: 'x', question: '' }), /valid/);
    assert.throws(() => store.create({ title: 'x', question: 'y', bypass: true }), /Unsupported/);
    store = await new BobQuestions(dir).init();
    assert.equal(store.list().length, 1);
    assert.equal(store.list()[0].question, item.question);
    await store.dismiss(item.id);
    assert.equal(store.list().length, 0);
    assert.equal(store.list({includeDismissed: true}).length, 1);
    const raw = await readFile(path.join(dir, 'bob-questions.json'), 'utf8');
    assert.match(raw, /dismissed/);
    assert.doesNotMatch(raw, /sent":true/);
  } finally { await rm(dir, {recursive:true,force:true}); }
});
