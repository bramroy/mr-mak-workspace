import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { coordinatorTools } from '../coordinator.mjs';
import { createService } from '../server.mjs';

const repoWithWorkspace = async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'mrmak-assign-service-'));
  await mkdir(path.join(repo, 'workspace')); await writeFile(path.join(repo, 'workspace/workspace.json'), '{"entities":[]}');
  return repo;
};

test('through the real coordinator tools: assign, receipt, refused close, independent verdict, close; and it survives a restart', async () => {
  const repo = await repoWithWorkspace(), stateDir = path.join(repo, '.mrmak');
  const names = coordinatorTools.map(item => item.name);
  for (const name of ['assign_task', 'record_receipt', 'record_verdict', 'close_task', 'handoff_task', 'accept_task', 'list_assignments']) assert.ok(names.includes(name), name);
  let service = await createService({ repo, uiDir: repo, stateDir, mcpOptions: { home: repo, env: {} } });
  let dispatcher;
  try {
    const run = (name, args) => service.coordinator.execute(name, args, 'op-' + name, 'test');
    await run('assign_task', { id: 'quoins', title: 'Quoins meet the soffit', intent: 'the soffit is the reference', owner: 'chat-implementer', repo: 'ZoddWorldTools' });
    await run('record_receipt', { id: 'quoins', sha: 'deadbee1', checks: [{ name: 'quoin_eave', result: 'NOT RUN' }], negativeSeenFailing: true });
    await assert.rejects(run('close_task', { id: 'quoins' }), /NOT RUN is not a pass/);
    await run('record_receipt', { id: 'quoins', sha: 'deadbee2', checks: [{ name: 'quoin_eave', result: 'PASS' }], negativeSeenFailing: true });
    await assert.rejects(run('record_verdict', { id: 'quoins', verifier: 'chat-implementer', sha: 'deadbee2', result: 'PASS' }), /cannot give its verdict/);
    await assert.rejects(run('close_task', { id: 'quoins' }), /independent verdict/);
    dispatcher = (await run('list_assignments', {})).dispatcher;
  } finally { await service.close(); }
  service = await createService({ repo, uiDir: repo, stateDir, mcpOptions: { home: repo, env: {} } });
  try {
    const run = (name, args) => service.coordinator.execute(name, args, 'op2-' + name, 'test');
    const listed = await run('list_assignments', {});
    assert.equal(listed.dispatcher, dispatcher, 'the same dispatcher after a restart');
    assert.equal(listed.open[0].receipts.length, 2);
    await run('record_verdict', { id: 'quoins', verifier: 'chat-reviewer', sha: 'deadbee2', result: 'PASS' });
    assert.equal((await run('close_task', { id: 'quoins' })).status, 'closed');
    assert.deepEqual((await run('list_assignments', {})).open, []);
  } finally { await service.close(); }
});

test('send_to_chat on the owning chat records the task text the stall watch re-sends', async () => {
  const repo = await repoWithWorkspace(), stateDir = path.join(repo, '.mrmak');
  process.env.MRMAK_NO_WATCHDOG = '1';
  const bin = await mkdtemp(path.join(os.tmpdir(), 'mrmak-fake-agent-')), previousPath = process.env.PATH;
  await writeFile(path.join(bin, 'claude'), '#!/usr/bin/env node\nprocess.stdin.resume(); setInterval(() => {}, 1000);\n'); await chmod(path.join(bin, 'claude'), 0o755);
  process.env.PATH = bin + path.delimiter + previousPath;
  const service = await createService({ repo, uiDir: repo, stateDir, mcpOptions: { home: repo, env: {} } });
  try {
    const session = await service.sessions.create({ agent: 'claude', cwd: repo, name: 'Quoin Work', bypass: false });
    const run = (name, args) => service.coordinator.execute(name, args, 'op-' + name, 'test');
    await run('assign_task', { id: 'q', title: 'Quoins', intent: 'the soffit is the reference', owner: session.id });
    assert.equal(service.coordinator.execute && (await run('list_assignments', {})).open[0].dispatch, undefined, 'nothing is re-sendable before the task is sent');
    await run('send_to_chat', { id: session.id, text: 'Make every quoin stack meet the soffit line.' });
    const task = (await run('list_assignments', {})).open[0];
    assert.equal(task.dispatch.text, 'Make every quoin stack meet the soffit line.'); assert.equal(task.dispatch.redispatches, 0);
    // Negative: a message to a chat that owns no assignment records nothing.
    const other = await service.sessions.create({ agent: 'claude', cwd: repo, name: 'Other Work', bypass: false });
    await run('send_to_chat', { id: other.id, text: 'unrelated' });
    assert.equal((await run('list_assignments', {})).open.filter(item => item.dispatch).length, 1);
  } finally { delete process.env.MRMAK_NO_WATCHDOG; process.env.PATH = previousPath; await service.close(); }
});

test('open_chat with a studio group lands the worker tab in that group; an unknown group is refused and opens nothing', async () => {
  const repo = await repoWithWorkspace(), stateDir = path.join(repo, '.mrmak');
  process.env.MRMAK_NO_WATCHDOG = '1';
  const bin = await mkdtemp(path.join(os.tmpdir(), 'mrmak-fake-agent-')), previousPath = process.env.PATH;
  await writeFile(path.join(bin, 'claude'), '#!/usr/bin/env node\nprocess.stdin.resume(); setInterval(() => {}, 1000);\n'); await chmod(path.join(bin, 'claude'), 0o755);
  process.env.PATH = bin + path.delimiter + previousPath;
  const service = await createService({ repo, uiDir: repo, stateDir, mcpOptions: { home: repo, env: {} } });
  try {
    const run = (name, args) => service.coordinator.execute(name, args, 'op-' + name + Math.random(), 'open a chat');
    const session = await run('open_chat', { agent: 'claude', name: 'Quoin Work', cwd: repo, group: 'Wizard' });
    assert.equal(service.sessions.get(session.id).group, 'Wizard');
    await assert.rejects(run('open_chat', { agent: 'claude', name: 'Other Work', cwd: repo, group: 'Random Group' }), /studio group/);
    assert.equal(service.sessions.list().length, 1);
  } finally { delete process.env.MRMAK_NO_WATCHDOG; process.env.PATH = previousPath; await service.close(); }
});
