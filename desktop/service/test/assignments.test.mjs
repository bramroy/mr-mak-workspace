import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Assignments, normalizeResult } from '../assignments.mjs';

const dir = () => mkdtemp(path.join(os.tmpdir(), 'mrmak-assign-'));
const task = { id: 't1', title: 'Quoins meet the soffit', intent: '"the soffit is the reference"', repo: 'ZoddWorldTools', branch: 'fix/quoins', baseSha: 'abc1234', owner: 'chat-implementer' };
const passing = { sha: 'deadbee1', checks: [{ name: 'quoin_eave_test', result: 'PASS' }], negativeSeenFailing: true };

test('a task closes only with a PASS receipt, a failing negative seen, and an independent PASS verdict on the same commit', async () => {
  const a = await new Assignments({ stateDir: await dir() }).init();
  await a.assign(task);
  await assert.rejects(a.close('t1'), /no receipt/);
  await a.receipt('t1', passing);
  await assert.rejects(a.close('t1'), /independent verdict/);
  await assert.rejects(a.verdict('t1', { verifier: 'chat-implementer', sha: 'deadbee1', result: 'PASS' }), /owner of the work cannot/);
  await a.verdict('t1', { verifier: 'chat-reviewer', sha: 'deadbee0', result: 'PASS' });
  await assert.rejects(a.close('t1'), /independent verdict on the receipt commit/, 'a verdict on a different commit does not count');
  await a.verdict('t1', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' });
  assert.equal((await a.close('t1')).status, 'closed');
});

test('negatives: NOT RUN, SKIPPED, FAIL and a missing negative case all keep the task open', async () => {
  assert.equal(normalizeResult('skipped'), 'NOT RUN');
  assert.throws(() => normalizeResult('green'), /PASS, FAIL or NOT RUN/);
  for (const [checks, negative, message] of [
    [[{ name: 'x', result: 'NOT RUN' }], true, /NOT RUN is not a pass/],
    [[{ name: 'x', result: 'SKIPPED' }], true, /NOT RUN is not a pass/],
    [[{ name: 'x', result: 'FAIL' }], true, /FAIL or NOT RUN/],
    [[{ name: 'x', result: 'PASS' }, { name: 'y', result: 'NOT RUN' }], true, /NOT RUN/],
    [[{ name: 'x', result: 'PASS' }], false, /no negative case/],
  ]) {
    const a = await new Assignments({ stateDir: await dir() }).init();
    await a.assign(task); await a.receipt('t1', { sha: 'deadbee1', checks, negativeSeenFailing: negative });
    await a.verdict('t1', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' });
    await assert.rejects(a.close('t1'), message);
  }
});

test('an assignment needs the owner\'s words, one owner, and a real commit ID', async () => {
  const a = await new Assignments({ stateDir: await dir() }).init();
  await assert.rejects(a.assign({ ...task, intent: '' }), /own words/);
  await assert.rejects(a.assign({ ...task, owner: '' }), /one owner/);
  await assert.rejects(a.assign({ ...task, baseSha: '--force' }), /hexadecimal/);
  await assert.rejects(a.receipt('missing', passing), /Unknown/);
  await a.assign(task);
  await assert.rejects(a.receipt('t1', { ...passing, sha: 'not-a-sha' }), /exact commit/);
  await assert.rejects(a.receipt('t1', { ...passing, checks: [] }), /checks that ran/);
});

test('one dispatcher: a second dispatcher cannot act on a task it does not hold, and a hand-over needs acceptance', async () => {
  const stateDir = await dir();
  const first = await new Assignments({ stateDir, dispatcherId: 'dispatcher-a' }).init();
  await first.assign(task);
  const second = await new Assignments({ stateDir: await dir(), dispatcherId: 'dispatcher-b' }).init();
  second.tasks = new Map(JSON.parse(JSON.stringify([...first.tasks])));
  await assert.rejects(second.receipt('t1', passing), /Another dispatcher \(dispatcher-a\) holds this task/);
  await assert.rejects(second.assign(task), /Another dispatcher/);
  await assert.rejects(second.accept('t1'), /not handed to this dispatcher/);
  await assert.rejects(first.handoff('t1', 'dispatcher-a'), /different dispatcher/);
  await first.handoff('t1', 'dispatcher-b');
  second.tasks = new Map(JSON.parse(JSON.stringify([...first.tasks])));
  await assert.rejects(second.receipt('t1', passing), /holds this task/, 'naming a successor does not transfer ownership until it accepts');
  await second.accept('t1');
  assert.equal((await second.receipt('t1', passing)).sha, 'deadbee1');
  await assert.rejects(first.receipt('t1', passing).then(() => { first.tasks = new Map(JSON.parse(JSON.stringify([...second.tasks]))); return first.receipt('t1', passing); }), /holds this task/);
});

test('charter, dispatcher identity and open assignments survive a restart', async () => {
  const stateDir = await dir();
  const before = await new Assignments({ stateDir }).init();
  await before.assign(task); await before.receipt('t1', passing);
  const after = await new Assignments({ stateDir }).init();
  assert.equal(after.dispatcherId, before.dispatcherId);
  assert.equal(after.get('t1').receipts.length, 1);
  const text = after.orientation();
  assert.ok(text.includes(before.dispatcherId) && text.includes('(you)') && text.includes('the soffit is the reference') && text.includes('Coordinator charter'));
});
