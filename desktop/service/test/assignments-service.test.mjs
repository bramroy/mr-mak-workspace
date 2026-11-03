import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
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
