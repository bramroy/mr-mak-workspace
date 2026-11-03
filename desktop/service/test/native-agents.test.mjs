import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AGENTS, inventory, terminalCommand, missingAgentMessage } from '../agents.mjs';

const emptyEnv = async () => ({ PATH: await mkdtemp(path.join(os.tmpdir(), 'mrmak-empty-path-')), HOME: os.tmpdir() });

test('negative: a missing Codex CLI is refused with a clear recovery message, never an inert tab', async () => {
  const env = await emptyEnv();
  const codex = inventory(env).find(item => item.id === 'codex');
  assert.equal(codex.available, false);
  assert.match(codex.recovery, /Codex is not installed on this computer/);
  assert.match(codex.recovery, /`codex` command was not found/);
  assert.match(codex.recovery, /npm install -g @openai\/codex/);
  assert.match(codex.recovery, /does not install or sign in for you/);
  const previous = process.env.PATH; process.env.PATH = env.PATH;
  try { assert.throws(() => terminalCommand('codex'), error => error.message === missingAgentMessage('codex')); } finally { process.env.PATH = previous; }
});

test('every agent that can be missing names its program, and a found command is available with no warning', async () => {
  for (const agent of AGENTS.filter(item => item.id !== 'shell')) assert.ok(missingAgentMessage(agent.id).includes(`\`${agent.command}\``), agent.id);
  const bin = await mkdtemp(path.join(os.tmpdir(), 'mrmak-codex-bin-'));
  await writeFile(path.join(bin, 'codex'), '#!/bin/sh\nexit 0\n'); await chmod(path.join(bin, 'codex'), 0o755);
  const env = { PATH: bin, HOME: os.tmpdir() }, codex = inventory(env).find(item => item.id === 'codex');
  assert.equal(codex.available, true); assert.equal(codex.recovery, undefined);
});
