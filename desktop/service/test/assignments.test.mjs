import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Assignments, normalizeResult, githubChecks, checkResult, executedTests, applyEvidence, normalizeSuites } from '../assignments.mjs';

const dir = () => mkdtemp(path.join(os.tmpdir(), 'mrmak-assign-'));
const READY = { provider: 'claude', requested: 'sonnet', observed: 'claude-sonnet-5-5' };
const github = (result = 'PASS', name = 'quoin_eave_test', executed = 12) => async () => [{ name, result, executed }];
const make = async (extra = {}) => { const a = await new Assignments({ stateDir: await dir(), verify: github(), openGates: true, ...extra }).init(); return a; };
const task = { id: 't1', title: 'Quoins meet the soffit', intent: '"the soffit is the reference"', taskText: 'Make every quoin stack meet the soffit line.', repo: 'bramroy/ZoddWorldTools', branch: 'fix/quoins', baseSha: 'abc1234', owner: 'chat-implementer', suites: ['quoin_eave_test'] };
const passing = { sha: 'deadbee1', checks: [{ name: 'quoin_eave_test', result: 'PASS' }], negativeSeenFailing: true };

test('a task closes only with a GitHub-verified PASS receipt, a failing negative seen, and an independent PASS verdict on the same commit', async () => {
  const a = await make();
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

test('negative: a model that reports PASS while GitHub says FAIL, NOT RUN or nothing cannot close the task', async () => {
  for (const [real, message] of [['FAIL', /FAIL or NOT RUN on GitHub/], ['NOT RUN', /NOT RUN is not a pass/]]) {
    const a = await make({ verify: github(real) });
    await a.assign(task);
    const receipt = await a.receipt('t1', passing); // The model claims PASS.
    assert.equal(receipt.verified, true); assert.equal(receipt.checks[0].result, real, 'GitHub\'s result is what is stored');
    assert.deepEqual(receipt.disagreements, [{ name: 'quoin_eave_test', reported: 'PASS', github: real }]);
    await a.verdict('t1', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' });
    await assert.rejects(a.close('t1'), message);
  }
  const named = await make({ verify: github('PASS', 'some_other_check') });
  await named.assign(task);
  assert.deepEqual((await named.receipt('t1', passing)).disagreements, [{ name: 'quoin_eave_test', reported: 'PASS', github: 'NOT FOUND' }], 'a check GitHub never ran is flagged');
});

test('negative: with no GitHub verifier, an unreachable GitHub or no repository, the receipt is unverified and cannot close', async () => {
  for (const [options, taskOverride, message] of [
    [{ verify: null }, {}, /not verified against GitHub/],
    [{ verify: async () => { throw new Error('GitHub did not return the checks (HTTP 401).'); } }, {}, /HTTP 401/],
  ]) {
    const a = await make(options);
    await a.assign({ ...task, ...taskOverride });
    const receipt = await a.receipt('t1', passing);
    assert.equal(receipt.verified, false);
    await a.verdict('t1', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' });
    await assert.rejects(a.close('t1'), message);
  }
});

test('GitHub check runs map to PASS only when completed successfully; queued, skipped and unknown are NOT RUN', async () => {
  assert.equal(checkResult({ status: 'completed', conclusion: 'success' }), 'PASS');
  for (const run of [{ status: 'queued' }, { status: 'in_progress' }, { status: 'completed', conclusion: 'skipped' }, { status: 'completed', conclusion: 'neutral' }, { status: 'completed', conclusion: 'weird' }, {}]) assert.equal(checkResult(run), 'NOT RUN', JSON.stringify(run));
  for (const conclusion of ['failure', 'timed_out', 'cancelled']) assert.equal(checkResult({ status: 'completed', conclusion }), 'FAIL');
  const ok = async () => ({ ok: true, status: 200, json: async () => ({ check_runs: [{ name: 'fast', status: 'completed', conclusion: 'success' }, { name: 'slow', status: 'in_progress' }] }) });
  assert.deepEqual((await githubChecks({ repo: 'a/b', sha: 'deadbee1', token: 't', fetchImpl: ok })).map(run => run.result), ['PASS', 'NOT RUN']);
  await assert.rejects(githubChecks({ repo: 'a/b', sha: 'deadbee1', token: '', fetchImpl: ok }), /No GitHub token/);
  await assert.rejects(githubChecks({ repo: '../x', sha: 'deadbee1', token: 't', fetchImpl: ok }), /owner\/name/);
  await assert.rejects(githubChecks({ repo: 'a/b', sha: 'deadbee1', token: 't', fetchImpl: async () => ({ ok: true, json: async () => ({ check_runs: [] }) }) }), /No checks is not a pass/);
  await assert.rejects(githubChecks({ repo: 'a/b', sha: 'deadbee1', token: 't', fetchImpl: async () => ({ ok: false, status: 404 }) }), /HTTP 404/);
});

test('negatives: a missing negative case and a model-reported NOT RUN or SKIPPED never pass', async () => {
  assert.equal(normalizeResult('skipped'), 'NOT RUN');
  assert.throws(() => normalizeResult('green'), /PASS, FAIL or NOT RUN/);
  const a = await make();
  await a.assign(task); await a.receipt('t1', { ...passing, negativeSeenFailing: false });
  await a.verdict('t1', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' });
  await assert.rejects(a.close('t1'), /no negative case/);
});

test('an assignment needs the owner\'s words, the original task text, one owner, a real commit and an owner/name repository', async () => {
  const a = await make();
  await assert.rejects(a.assign({ ...task, intent: '' }), /own words/);
  await assert.rejects(a.assign({ ...task, taskText: '' }), /task text/);
  await assert.rejects(a.assign({ ...task, owner: '' }), /one owner/);
  await assert.rejects(a.assign({ ...task, baseSha: '--force' }), /hexadecimal/);
  await assert.rejects(a.assign({ ...task, repo: 'not a repo' }), /owner\/name/);
  await assert.rejects(a.receipt('missing', passing), /Unknown/);
  await a.assign(task);
  await assert.rejects(a.receipt('t1', { ...passing, sha: 'not-a-sha' }), /exact commit/);
  await assert.rejects(a.receipt('t1', { ...passing, checks: [] }), /checks that ran/);
});

test('one dispatcher per state folder: a second process is read only until the first releases, and a dead holder is taken over', async () => {
  const stateDir = await dir();
  const first = await new Assignments({ stateDir, pid: process.pid, openGates: true }).init();
  assert.equal(first.readOnly, null);
  await first.assign(task);
  const second = await new Assignments({ stateDir, pid: 424242 }).init(); // Same folder, a different live process.
  assert.match(second.readOnly, /another Mr\. Mak process/);
  assert.equal(second.dispatcherId, first.dispatcherId, 'the same identity is exactly why a lock is needed');
  for (const act of [() => second.assign({ ...task, id: 't2' }), () => second.receipt('t1', passing), () => second.verdict('t1', { verifier: 'x', sha: 'deadbee1', result: 'PASS' }), () => second.close('t1'), () => second.accept('t1'), () => second.approveCutover('o', READY)]) await assert.rejects(act(), /Read only/);
  assert.equal(second.get('t1').title, task.title, 'reading still works');
  assert.equal(await second.markDispatched('chat-implementer'), null, 'and it never starts a clock');
  await first.release();
  const third = await new Assignments({ stateDir, pid: 515151 }).init();
  assert.equal(third.readOnly, null, 'the lock is free after a clean release');
  await third.release();
  await writeFile(path.join(stateDir, 'dispatcher.lock'), JSON.stringify({ pid: 2 ** 22 + 12345, dispatcherId: 'dead' }));
  const fourth = await new Assignments({ stateDir, pid: 616161 }).init();
  assert.equal(fourth.readOnly, null, 'a lock whose process is gone is stale and is taken over');
});

const proofArgs = { id: 'p1', owner: 'chat-implementer', repo: 'bramroy/ZoddWorldTools', suites: ['quoin_eave_test'] };
test('cutover from the old dispatcher: real work is refused until Sonnet is observed, an owner-started proof closed, and the owner approved', async () => {
  const a = await make({ openGates: false });
  const real = { ...task, id: 'real' };
  await assert.rejects(a.assign(real, { identity: READY }), /cutover gates.*proof, owner/);
  await assert.rejects(a.assign(real, { identity: { provider: 'claude', requested: 'sonnet', observed: null } }), /cutover gates.*model/);
  await a.startProof(proofArgs); // The owner's act: always allowed.
  await assert.rejects(a.approveCutover('Brandon', READY), /proof task has been closed|no proof task/);
  await a.receipt('p1', passing); await a.verdict('p1', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' }); await a.close('p1');
  await assert.rejects(a.approveCutover('Brandon', { provider: 'claude', requested: 'sonnet', observed: 'claude-opus-5-5' }), /reports claude-opus-5-5/);
  await assert.rejects(a.assign(real, { identity: READY }), /cutover gates.*owner/, 'still refused until the owner approves');
  await a.approveCutover('Brandon', READY);
  assert.equal((await a.assign(real, { identity: READY })).id, 'real');
  await assert.rejects(a.assign({ ...real, id: 'real2' }, { identity: { provider: 'codex', requested: null, observed: 'gpt' } }), /cutover gates.*model/, 'the gate re-checks the live model every time');
});

test('negative: the coordinator cannot label its own work as proof; only the owner-started task with fixed text opens the gate', async () => {
  const a = await make({ openGates: false });
  await assert.rejects(a.assign({ ...task, proof: true }, { identity: READY }), /owner from the Coordinator panel, never by the coordinator/);
  await assert.rejects(a.assign({ ...task, proof: 'yes' }), /never by the coordinator/);
  const started = await a.startProof(proofArgs);
  assert.equal(started.proof, true);
  assert.match(started.taskText, /disposable cutover proof/, 'the text is fixed by the app, not by the model');
  assert.equal(started.intent, 'Prove the coordinator can dispatch, verify and close one disposable task before real work moves to it.');
  await assert.rejects(a.startProof({ ...proofArgs, id: 'p2', repo: 'nonsense' }), /owner\/name/);
  assert.equal((await make({ openGates: false })).gates(READY).find(gate => gate.name === 'proof').ok, false, 'an assigned task that only claims proof leaves the gate shut');
});

test('negative: a Codex or Bob worker needs its own closed proof before real work goes to it, then closes on the same evidence', async () => {
  const a = await make({ openGates: false });
  await a.startProof({ ...proofArgs, id: 'pc' }, { workerKind: 'claude' });
  await a.receipt('pc', passing); await a.verdict('pc', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' }); await a.close('pc');
  await a.approveCutover('Brandon', READY);
  assert.equal((await a.assign({ ...task, id: 'cl' }, { identity: READY, workerKind: 'claude' })).workerKind, 'claude');
  for (const kind of ['codex', 'bob']) {
    await assert.rejects(a.assign({ ...task, id: `x-${kind}` }, { identity: READY, workerKind: kind }), new RegExp(`cutover gates.*worker`), `no ${kind} proof yet`);
    assert.match(a.gates(READY, kind).find(gate => gate.name === 'worker').detail, new RegExp(`no ${kind} worker has closed`));
  }
  await a.startProof({ ...proofArgs, id: 'px' }, { workerKind: 'codex' });
  await a.receipt('px', passing); await a.verdict('px', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' });
  await assert.rejects(a.assign({ ...task, id: 'cx0' }, { identity: READY, workerKind: 'codex' }), /worker/, 'an open proof is not a closed one');
  await a.close('px');
  const codex = await a.assign({ ...task, id: 'cx' }, { identity: READY, workerKind: 'codex' });
  assert.equal(codex.workerKind, 'codex');
  await assert.rejects(a.assign({ ...task, id: 'bb' }, { identity: READY, workerKind: 'bob' }), /worker/, 'Codex proof does not open the Bob gate');
  // The Codex task closes only on the same evidence as everyone else's.
  await a.receipt('cx', { ...passing, negativeSeenFailing: false }); await a.verdict('cx', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' });
  await assert.rejects(a.close('cx'), /no negative case/);
});

test('negative: a green check run with no test count, zero tests, or a missing suite is NOT RUN and cannot close', async () => {
  assert.equal(executedTests({ output: { summary: '# tests 330\n# pass 320\n# fail 2\n# skipped 8' } }), 320);
  assert.equal(executedTests({ output: { title: '42 passed, 1 skipped' } }), 42);
  assert.equal(executedTests({ output: { summary: '0 passed, 8 skipped' } }), 0);
  assert.equal(executedTests({ output: { summary: 'All good' } }), null);
  assert.equal(executedTests({}), null);
  const suites = normalizeSuites(['vendor tests', { name: 'service tests', min: 300 }]);
  const checks = [{ name: 'vendor tests', result: 'PASS', executed: 5 }, { name: 'service tests', result: 'PASS', executed: 12 }, { name: 'lint', result: 'PASS', executed: null }];
  const applied = applyEvidence(suites, checks);
  assert.equal(applied[0].result, 'PASS'); assert.equal(applied[1].result, 'NOT RUN'); assert.match(applied[1].evidence, /only 12/); assert.equal(applied[2].result, 'PASS', 'a check outside the suites is not held to a count');
  assert.equal(applyEvidence(normalizeSuites(['vendor tests']), [{ name: 'vendor tests', result: 'PASS', executed: null }])[0].result, 'NOT RUN');
  assert.equal(applyEvidence(normalizeSuites(['vendor tests']), [{ name: 'vendor tests', result: 'PASS', executed: 0 }])[0].result, 'NOT RUN');
  assert.deepEqual(applyEvidence(normalizeSuites(['vendor tests']), []).map(check => [check.name, check.result]), [['vendor tests', 'NOT RUN']]);
  assert.throws(() => normalizeSuites([]), /Name the check runs/); assert.throws(() => normalizeSuites(['']), /check name/); assert.throws(() => normalizeSuites([{ name: 'x', min: 0 }]), /whole number/);
  for (const [verify, label] of [[github('PASS', 'quoin_eave_test', null), 'no count'], [github('PASS', 'quoin_eave_test', 0), 'zero tests'], [github('PASS', 'another_check', 9), 'suite missing']]) {
    const a = await make({ verify });
    await a.assign(task);
    const receipt = await a.receipt('t1', passing);
    assert.ok(receipt.checks.find(check => check.name === 'quoin_eave_test').result === 'NOT RUN', label);
    assert.ok(receipt.disagreements.length >= 1, `${label}: the model claimed PASS`);
    await a.verdict('t1', { verifier: 'chat-reviewer', sha: 'deadbee1', result: 'PASS' });
    await assert.rejects(a.close('t1'), /NOT RUN is not a pass|FAIL or NOT RUN/, label);
  }
  const a = await make();
  await assert.rejects(a.assign({ ...task, suites: undefined }), /Name the check runs/, 'real work must name its suites');
  await assert.rejects(a.assign({ ...task, repo: null }), /Name the repository/);
});

test('one dispatcher per task: another dispatcher cannot act, and a hand-over needs acceptance', async () => {
  const first = await make({ dispatcherId: 'dispatcher-a' });
  await first.assign(task);
  const second = await new Assignments({ stateDir: await dir(), dispatcherId: 'dispatcher-b', verify: github(), openGates: true }).init();
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
});

test('charter, dispatcher identity, original task text and open assignments survive a restart', async () => {
  const stateDir = await dir();
  const before = await new Assignments({ stateDir, verify: github(), openGates: true }).init();
  await before.assign(task); await before.receipt('t1', passing); await before.release();
  const after = await new Assignments({ stateDir }).init();
  assert.equal(after.dispatcherId, before.dispatcherId);
  assert.equal(after.get('t1').receipts.length, 1); assert.equal(after.get('t1').taskText, task.taskText);
  const text = after.orientation(READY);
  assert.ok(text.includes(before.dispatcherId) && text.includes('(you)') && text.includes('the soffit is the reference') && text.includes('Coordinator charter') && text.includes('Cutover gates') && text.includes('NOT YET'));
});
