import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ClaudeCoordinator, CLAUDE_COORDINATOR_MODELS, DEFAULT_CLAUDE_COORDINATOR_MODEL, claudeCoordinatorModel } from '../coordinator-claude.mjs';
import { createService } from '../server.mjs';

// A stand-in `claude` that records how it was started and reports the model it "runs", like the real stream does.
async function fakeClaude(reported) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mrmak-fake-claude-'));
  const log = path.join(dir, 'args.json');
  const script = `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));
console.log(JSON.stringify({ type: 'system', subtype: 'init', model: ${JSON.stringify(reported)} }));
process.stdin.resume();
`;
  await writeFile(path.join(dir, 'claude'), script); await chmod(path.join(dir, 'claude'), 0o755);
  return { dir, log };
}
const started = async (model, reported = 'claude-sonnet-5-5') => {
  const fake = await fakeClaude(reported), previous = process.env.PATH;
  process.env.PATH = fake.dir + path.delimiter + previous;
  const coordinator = new ClaudeCoordinator({ repo: fake.dir, stateDir: fake.dir, execute: async () => ({}), context: () => ({}), settings: () => ({ coordinatorModel: model }), toolUrl: () => 'http://127.0.0.1:1' });
  try {
    await coordinator.start();
    for (let i = 0; i < 100 && !coordinator.observedModel; i++) await new Promise(resolve => setTimeout(resolve, 20));
    return { args: JSON.parse(await readFile(fake.log, 'utf8')), identity: coordinator.identity(), coordinator };
  } finally { process.env.PATH = previous; }
};

test('the Claude coordinator is Sonnet unless the owner picks another listed model', async () => {
  assert.equal(DEFAULT_CLAUDE_COORDINATOR_MODEL, 'sonnet');
  for (const [asked, expected] of [[undefined, 'sonnet'], [null, 'sonnet'], ['sonnet', 'sonnet'], ['opus', 'opus'], ['haiku', 'haiku']]) {
    const { args, coordinator } = await started(asked);
    try { assert.equal(args[args.indexOf('--model') + 1], expected, `asked ${asked}`); } finally { coordinator.close(); }
  }
});

test('negative: an unlisted model value never reaches the command line', async () => {
  for (const bad of ['gpt-5', '--dangerously-skip-permissions', 'sonnet; calc', '', 7, {}]) {
    assert.equal(claudeCoordinatorModel(bad), 'sonnet');
    const { args, coordinator } = await started(bad);
    try { assert.equal(args[args.indexOf('--model') + 1], 'sonnet'); assert.ok(!args.includes(String(bad)) || bad === '', `leaked ${bad}`); } finally { coordinator.close(); }
  }
});

test('the identity shows the model the process reports, not only the label that was requested', async () => {
  const { identity, coordinator } = await started('sonnet', 'claude-sonnet-5-5');
  try {
    assert.deepEqual({ provider: identity.provider, requested: identity.requested, observed: identity.observed }, { provider: 'claude', requested: 'sonnet', observed: 'claude-sonnet-5-5' });
  } finally { coordinator.close(); }
  // Negative: when the process reports a different model than was requested, that difference is visible.
  const mismatch = await started('sonnet', 'claude-opus-5-5');
  try { assert.notEqual(mismatch.identity.observed, mismatch.identity.requested); assert.equal(mismatch.identity.observed, 'claude-opus-5-5'); } finally { mismatch.coordinator.close(); }
});

test('the settings API accepts only listed coordinator models', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'mrmak-coordinator-model-'));
  await mkdir(path.join(repo, 'workspace'));
  await writeFile(path.join(repo, 'workspace/workspace.json'), '{"entities":[]}');
  const service = await createService({ repo, uiDir: repo, mcpOptions: { home: repo, env: {} } });
  const post = data => fetch(service.origin + '/api/settings', { method: 'POST', headers: { Authorization: `Bearer ${service.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const read = async () => (await (await fetch(service.origin + '/api/bootstrap', { headers: { Authorization: `Bearer ${service.token}` } })).json());
  try {
    let boot = await read();
    assert.equal(boot.settings.coordinatorAgent, 'claude');
    assert.equal(boot.settings.coordinatorModel, 'sonnet');
    assert.equal(boot.coordinatorIdentity.provider, 'claude');
    for (const model of CLAUDE_COORDINATOR_MODELS) assert.equal((await post({ coordinatorModel: model })).ok, true, model);
    assert.equal((await read()).settings.coordinatorModel, 'haiku');
    for (const bad of ['gpt-5', '--yolo', null, 7]) assert.equal((await post({ coordinatorModel: bad })).ok, false, String(bad));
    assert.equal((await read()).settings.coordinatorModel, 'haiku', 'a refused value must not change the saved model');
  } finally { await service.close(); }
});
