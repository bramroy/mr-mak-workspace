import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Assignments } from '../assignments.mjs';
import { DispatchWatchdog, assess, DEFAULTS } from '../watchdog.mjs';

const MIN = 60_000, T0 = Date.parse('2026-11-03T10:00:00Z');
const iso = ms => new Date(ms).toISOString();
const chat = (extra = {}) => ({ id: 'chat-1', agent: 'claude', status: 'running', activity: 'idle', attention: false, lastOutputAt: iso(T0), ...extra });
const fixture = async () => {
  const a = await new Assignments({ stateDir: await mkdtemp(path.join(os.tmpdir(), 'mrmak-watch-')) }).init();
  await a.assign({ id: 't1', title: 'Quoins meet the soffit', intent: 'the soffit is the reference', owner: 'chat-1' });
  await a.markDispatched('chat-1', 'Make every quoin stack meet the soffit line on every roof type.', T0);
  return a;
};
const watch = (a, state, extra = {}) => {
  const sent = [], notes = [];
  const dog = new DispatchWatchdog({ assignments: a, chats: () => [state.chat], send: async (id, text) => { sent.push({ id, text }); }, notify: note => notes.push(note), ...extra });
  return { dog, sent, notes };
};

test('"I am working" then silence: the task is sent again by itself, with the original words', async () => {
  const a = await fixture(), state = { chat: chat({ activity: 'working', lastOutputAt: iso(T0 + 1 * MIN) }) };
  const { dog, sent } = watch(a, state);
  assert.deepEqual(await dog.check(T0 + 3 * MIN), [], 'still inside the wait');
  const done = await dog.check(T0 + 6 * MIN);
  assert.equal(done[0].action, 'redispatch'); assert.match(done[0].reason, /says it is working but has written nothing/);
  assert.equal(sent.length, 1); assert.equal(sent[0].id, 'chat-1');
  assert.ok(sent[0].text.includes('Make every quoin stack meet the soffit line on every roof type.'));
  assert.equal(a.get('t1').dispatch.redispatches, 1);
});

test('a worker that was sent the task and went idle without starting is re-sent', async () => {
  const a = await fixture(), state = { chat: chat({ activity: 'idle', lastOutputAt: iso(T0 - 5 * MIN) }) };
  const { dog, sent } = watch(a, state);
  assert.deepEqual(await dog.check(T0 + 1 * MIN), []);
  assert.equal((await dog.check(T0 + 3 * MIN))[0].reason, 'it never started the task it was sent');
  assert.equal(sent.length, 1);
});

test('negative: a worker that is producing output is left alone', async () => {
  const a = await fixture(), state = { chat: chat({ activity: 'working' }) };
  const { dog, sent } = watch(a, state);
  for (let minute = 1; minute <= 30; minute++) { state.chat.lastOutputAt = iso(T0 + minute * MIN); assert.deepEqual(await dog.check(T0 + minute * MIN + 10_000), [], `minute ${minute}`); }
  assert.equal(sent.length, 0);
});

test('negative: it re-sends with growing waits, stops after the limit, and then tells the owner instead of looping', async () => {
  const a = await fixture(), state = { chat: chat({ activity: 'working', lastOutputAt: iso(T0) }) };
  const { dog, sent, notes } = watch(a, state);
  let now = T0, actions = [];
  for (let step = 0; step < 200; step++) { now += MIN; for (const item of await dog.check(now)) actions.push(item.action); }
  assert.equal(sent.length, DEFAULTS.maxRedispatch, 'exactly the limit, never more');
  assert.equal(actions.filter(action => action === 'escalate').length, 1, 'the owner is told once');
  assert.equal(notes.length, 1); assert.match(notes[0].text, /re-sends did not help/);
  assert.ok(a.get('t1').stalled.reason.includes('re-sends did not help'));
});

test('negative: a chat waiting on a question or a permission is never answered by the coordinator, only escalated', async () => {
  for (const waiting of [{ activity: 'waiting' }, { attention: true }]) {
    const a = await fixture(), state = { chat: chat({ ...waiting, lastOutputAt: iso(T0) }) };
    const { dog, sent, notes } = watch(a, state);
    const done = await dog.check(T0 + 20 * MIN);
    assert.equal(sent.length, 0, 'nothing is typed into a permission prompt'); assert.equal(done[0].action, 'escalate'); assert.equal(notes.length, 1);
  }
});

test('a missing, stopped or exited chat is escalated; closed tasks and shells are ignored', async () => {
  const a = await fixture();
  assert.equal(assess(a.get('t1'), undefined, T0 + MIN).action, 'escalate');
  assert.equal(assess(a.get('t1'), chat({ status: 'exited' }), T0 + MIN).action, 'escalate');
  assert.equal(assess(a.get('t1'), chat({ agent: 'shell', activity: 'working' }), T0 + 60 * MIN).action, 'none');
  assert.equal(assess({ ...a.get('t1'), status: 'closed' }, chat({ activity: 'working' }), T0 + 60 * MIN).action, 'none');
  assert.equal(assess({ ...a.get('t1'), dispatch: undefined }, chat({ activity: 'working' }), T0 + 60 * MIN).action, 'none', 'a task never sent has nothing to resend');
});

test('a receipt ends the watch: a worker that answered and went idle is not nagged', async () => {
  const a = await fixture(), state = { chat: chat({ activity: 'idle', lastOutputAt: iso(T0 + 2 * MIN) }) };
  await a.receipt('t1', { sha: 'deadbee1', checks: [{ name: 'x', result: 'PASS' }], negativeSeenFailing: true });
  const { dog, sent } = watch(a, state);
  assert.deepEqual(await dog.check(T0 + 40 * MIN), []);
  assert.equal(sent.length, 0);
});

import { Overseer } from '../overseer.mjs';
test('one nudger per chat: Overseer mode skips a chat the dispatch watchdog owns, and still covers every other chat', async () => {
  const a = await fixture();
  const stuck = id => ({ id, name: id, agent: 'claude', status: 'running', activity: 'working', lastOutputAt: iso(T0) });
  const asked = [];
  const overseer = new Overseer({ chats: () => [stuck('chat-1'), stuck('chat-2')], ask: async request => { asked.push(request.text); }, enabled: () => true, skip: id => a.owns(id) });
  await overseer.check(T0 + 60 * MIN);
  assert.equal(asked.length, 1);
  assert.ok(asked[0].includes('chat-2') && !asked[0].includes('"id":"chat-1"'), 'the assigned chat is left to the watchdog');
});
