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
  const verifyChecks = async ({ sha }) => [{ name: 'quoin_eave', result: sha === 'deadbee2' ? 'PASS' : 'NOT RUN', executed: sha === 'deadbee2' ? 7 : null }]; // Stands in for GitHub's check runs.
  let service = await createService({ repo, uiDir: repo, stateDir, verifyChecks, mcpOptions: { home: repo, env: {} } });
  let dispatcher;
  try {
    const run = (name, args) => service.coordinator.execute(name, args, 'op-' + name, 'test');
    const spec = { id: 'quoins', title: 'Quoins meet the soffit', intent: 'the soffit is the reference', taskText: 'Make quoins meet the soffit.', owner: 'chat-implementer', repo: 'bramroy/ZoddWorldTools', suites: ['quoin_eave'] };
    // Negative: through the model's tools, a task cannot be labelled proof, and real work is shut until the owner-started proof closes.
    await assert.rejects(run('assign_task', { ...spec, proof: true }), /never by the coordinator/);
    await assert.rejects(run('assign_task', spec), /cutover gates/);
    const started = await service.assignments.startProof({ id: 'quoins', owner: 'chat-implementer', repo: spec.repo, suites: spec.suites });
    assert.equal(started.proof, true);
    await run('record_receipt', { id: 'quoins', sha: 'deadbee1', checks: [{ name: 'quoin_eave', result: 'NOT RUN' }], negativeSeenFailing: true });
    await assert.rejects(run('close_task', { id: 'quoins' }), /FAIL or NOT RUN on GitHub/);
    await run('record_receipt', { id: 'quoins', sha: 'deadbee2', checks: [{ name: 'quoin_eave', result: 'PASS' }], negativeSeenFailing: true });
    const claimed = await run('record_receipt', { id: 'quoins', sha: 'deadbee1', checks: [{ name: 'quoin_eave', result: 'PASS' }], negativeSeenFailing: true }); // The model says PASS; GitHub says NOT RUN.
    assert.equal(claimed.checks[0].result, 'NOT RUN');
    await run('record_receipt', { id: 'quoins', sha: 'deadbee2', checks: [{ name: 'quoin_eave', result: 'PASS' }], negativeSeenFailing: true });
    await assert.rejects(run('record_verdict', { id: 'quoins', verifier: 'chat-implementer', sha: 'deadbee2', result: 'PASS' }), /cannot give its verdict/);
    await assert.rejects(run('close_task', { id: 'quoins' }), /independent verdict/);
    dispatcher = (await run('list_assignments', {})).dispatcher;
  } finally { await service.close(); }
  service = await createService({ repo, uiDir: repo, stateDir, verifyChecks, mcpOptions: { home: repo, env: {} } });
  try {
    const run = (name, args) => service.coordinator.execute(name, args, 'op2-' + name, 'test');
    const listed = await run('list_assignments', {});
    assert.equal(listed.dispatcher, dispatcher, 'the same dispatcher after a restart');
    assert.equal(listed.open[0].receipts.length, 4);
    await run('record_verdict', { id: 'quoins', verifier: 'chat-reviewer', sha: 'deadbee2', result: 'PASS' });
    assert.equal((await run('close_task', { id: 'quoins' })).status, 'closed');
    assert.deepEqual((await run('list_assignments', {})).open, []);
  } finally { await service.close(); }
});

test('send_to_chat on the owning chat starts the stall clock and never replaces the saved task', async () => {
  const repo = await repoWithWorkspace(), stateDir = path.join(repo, '.mrmak');
  process.env.MRMAK_NO_WATCHDOG = '1';
  const bin = await mkdtemp(path.join(os.tmpdir(), 'mrmak-fake-agent-')), previousPath = process.env.PATH;
  await writeFile(path.join(bin, 'claude'), '#!/usr/bin/env node\nprocess.stdin.resume(); setInterval(() => {}, 1000);\n'); await chmod(path.join(bin, 'claude'), 0o755);
  process.env.PATH = bin + path.delimiter + previousPath;
  const service = await createService({ repo, uiDir: repo, stateDir, mcpOptions: { home: repo, env: {} } });
  try {
    const session = await service.sessions.create({ agent: 'claude', cwd: repo, name: 'Quoin Work', bypass: false });
    const run = (name, args) => service.coordinator.execute(name, args, 'op-' + name, 'test');
    const saved = (await service.assignments.startProof({ id: 'q', owner: session.id, repo: 'bramroy/ZoddWorldTools', suites: ['tests'] })).taskText;
    assert.equal(service.coordinator.execute && (await run('list_assignments', {})).open[0].dispatch, undefined, 'nothing is re-sendable before the task is sent');
    await run('send_to_chat', { id: session.id, text: 'Make every quoin stack meet the soffit line.' });
    const task = (await run('list_assignments', {})).open[0];
    assert.equal(task.taskText, saved); assert.equal(task.dispatch.redispatches, 0); assert.equal(task.dispatch.followups, 0);
    await run('send_to_chat', { id: session.id, text: 'thanks, carry on' });
    const after = (await run('list_assignments', {})).open[0];
    assert.equal(after.taskText, saved, 'a follow-up never replaces the saved task'); assert.equal(after.dispatch.followups, 1);
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

test('the owner starts a proof over HTTP; the worker kind comes from the real chat, and an unauthenticated or malformed request starts nothing', async () => {
  const repo = await repoWithWorkspace(), stateDir = path.join(repo, '.mrmak');
  process.env.MRMAK_NO_WATCHDOG = '1';
  const bin = await mkdtemp(path.join(os.tmpdir(), 'mrmak-fake-agent-')), previousPath = process.env.PATH;
  await writeFile(path.join(bin, 'claude'), '#!/usr/bin/env node\nprocess.stdin.resume(); setInterval(() => {}, 1000);\n'); await chmod(path.join(bin, 'claude'), 0o755);
  process.env.PATH = bin + path.delimiter + previousPath;
  const service = await createService({ repo, uiDir: repo, stateDir, mcpOptions: { home: repo, env: {} } });
  try {
    const session = await service.sessions.create({ agent: 'claude', cwd: repo, name: 'Proof Worker', bypass: false });
    const post = (body, token = service.token) => fetch(service.origin + '/api/coordinator/proof', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({ owner: session.id, repo: 'bramroy/ZoddWorldTools', suites: ['tests'] }, 'wrong')).status, 401);
    assert.equal((await post({ owner: session.id, repo: 'nonsense', suites: ['tests'] })).ok, false);
    assert.equal((await post({ owner: session.id, repo: 'bramroy/ZoddWorldTools', suites: [] })).ok, false);
    assert.deepEqual((await (await fetch(service.origin + '/api/coordinator/assignments', { headers: { Authorization: `Bearer ${service.token}` } })).json()).open, [], 'the refused requests started nothing');
    const made = await post({ owner: session.id, repo: 'bramroy/ZoddWorldTools', suites: ['tests'] });
    assert.equal(made.status, 201);
    const task = await made.json();
    assert.equal(task.proof, true); assert.equal(task.workerKind, 'claude', 'read from the chat, not claimed'); assert.equal(task.owner, session.id);
    const other = await (await post({ owner: 'codex', repo: 'bramroy/ZoddWorldTools', suites: ['tests'] })).json();
    assert.equal(other.workerKind, 'codex');
  } finally { delete process.env.MRMAK_NO_WATCHDOG; process.env.PATH = previousPath; await service.close(); }
});
