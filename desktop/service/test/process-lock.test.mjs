import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Assignments } from '../assignments.mjs';
import { parseCpuTime, processTreeCpuMs, treeCpuFromRows } from '../platform.mjs';

const module = fileURLToPath(new URL('../assignments.mjs', import.meta.url));

test('a real second process on the same state folder cannot dispatch while the first lives, and can once it exits', async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'mrmak-lock-'));
  const child = spawn(process.execPath, ['--input-type=module', '-e', `import { Assignments } from ${JSON.stringify(module)}; const a = await new Assignments({ stateDir: ${JSON.stringify(stateDir)} }).init(); console.log(a.readOnly ? 'readonly' : 'holder'); process.stdin.resume(); process.stdin.on('end', async () => { await a.release(); process.exit(0); });`], { stdio: ['pipe', 'pipe', 'inherit'] });
  const first = await new Promise(resolve => child.stdout.once('data', data => resolve(String(data).trim())));
  assert.equal(first, 'holder');
  const second = await new Assignments({ stateDir }).init();
  assert.match(second.readOnly, new RegExp(`pid ${child.pid}`));
  await assert.rejects(second.assign({ title: 't', intent: 'i', taskText: 'x', owner: 'o', repo: 'a/b', suites: ['tests'] }), /Read only/);
  const exited = new Promise(resolve => child.once('exit', resolve)); child.stdin.end(); await exited;
  const third = await new Assignments({ stateDir }).init();
  assert.equal(third.readOnly, null, 'the lock is released when its holder exits');
  await third.release();
});

test('a holder killed without releasing leaves a stale lock that the next process takes over', async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'mrmak-lock-'));
  const child = spawn(process.execPath, ['--input-type=module', '-e', `import { Assignments } from ${JSON.stringify(module)}; await new Assignments({ stateDir: ${JSON.stringify(stateDir)} }).init(); console.log('up'); setInterval(() => {}, 1000);`], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(resolve => child.stdout.once('data', resolve));
  child.kill('SIGKILL'); await new Promise(resolve => child.once('exit', resolve));
  const next = await new Assignments({ stateDir }).init();
  assert.equal(next.readOnly, null); await next.release();
});

test('CPU time of a process tree: a busy child is seen, an idle one is not', async (t) => {
  assert.equal(parseCpuTime('00:00:01'), 1000); assert.equal(parseCpuTime('1-02:03:04'), 93784000); assert.equal(parseCpuTime('03:04.50'), 184500); assert.equal(parseCpuTime('x'), null);
  assert.equal(treeCpuFromRows([{ pid: 1, ppid: 0, ms: 100 }, { pid: 2, ppid: 1, ms: 250 }, { pid: 3, ppid: 2, ms: 50 }, { pid: 9, ppid: 0, ms: 9999 }], 1), 400, 'the root and everything it started, nothing else');
  assert.equal(treeCpuFromRows([{ pid: 1, ppid: 0, ms: 100 }], 77), null);
  if (process.platform === 'win32') return t.skip('the Windows sampler runs on the laptop (NOT RUN here)');
  const idle = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const busy = spawn(process.execPath, ['-e', 'const end = Date.now() + 6000; while (Date.now() < end) {}'], { stdio: 'ignore' });
  try {
    const before = [await processTreeCpuMs(idle.pid), await processTreeCpuMs(busy.pid)];
    await new Promise(resolve => setTimeout(resolve, 3500));
    const after = [await processTreeCpuMs(idle.pid), await processTreeCpuMs(busy.pid)];
    assert.ok(after[1] - before[1] >= 1000, `busy child used ${after[1] - before[1]} ms`);
    assert.ok(after[0] - before[0] < 1000, `idle child used ${after[0] - before[0]} ms`);
  } finally { idle.kill(); busy.kill(); }
});
