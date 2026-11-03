import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { Assignments, githubChecks } from '../assignments.mjs';
import { generateRunnerKey, runReceipt, verifyReceipt, parseCounts } from '../test-receipts.mjs';

const tmp = prefix => mkdtemp(path.join(os.tmpdir(), prefix));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
// A real checkout with a real remote and a real node:test suite, so the receipt runs real commands against real commits.
async function checkout(tests = 3) {
  const remote = await tmp('mrmak-remote-'), cwd = await tmp('mrmak-checkout-');
  git(remote, 'init', '-q', '--bare');
  git(cwd, 'init', '-q', '-b', 'main'); git(cwd, 'config', 'user.email', 't@t'); git(cwd, 'config', 'user.name', 't');
  const body = Array.from({ length: tests }, (_, index) => `test('works ${index}', () => assert.equal(1 + 1, 2));`).join('\n');
  await writeFile(path.join(cwd, 'suite.test.mjs'), `import test from 'node:test'; import assert from 'node:assert/strict';\n${body}\n`);
  git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'suite'); git(cwd, 'remote', 'add', 'origin', remote); git(cwd, 'push', '-q', 'origin', 'main');
  return { cwd, sha: git(cwd, 'rev-parse', 'HEAD') };
}
const COMMAND = 'node --test suite.test.mjs';
const REPO = 'bramroy/mr-mak-workspace';
const SUITE = 'service tests';
const author = generateRunnerKey(), reviewer = generateRunnerKey(), stranger = generateRunnerKey();
const run = (cwd, key, runner, extra = {}) => runReceipt({ cwd, repo: REPO, suite: SUITE, command: COMMAND, privateKeyPem: key.privateKeyPem, runner, ...extra });
const registered = [{ name: 'Author Box', role: 'author', publicKeyPem: author.publicKeyPem }, { name: 'Reviewer Box', role: 'reviewer', publicKeyPem: reviewer.publicKeyPem }];

test('parseCounts reads node:test summaries in TAP and spec form; a missing summary is null', () => {
  assert.deepEqual(parseCounts('# tests 12\n# pass 10\n# fail 1\n# skipped 1\n'), { tests: 12, pass: 10, fail: 1, skipped: 1 });
  assert.equal(parseCounts('ℹ tests 5\nℹ pass 5\nℹ fail 0\nℹ skipped 0').pass, 5);
  assert.equal(parseCounts('all green').pass, null);
});

test('a real run of a real suite is signed, and verifies against a registered runner', async () => {
  const { cwd, sha } = await checkout(3);
  const receipt = await run(cwd, author, 'Author Box');
  assert.equal(receipt.payload.sha, sha); assert.equal(receipt.payload.clean, true); assert.equal(receipt.payload.pushed, true); assert.equal(receipt.payload.counts.pass, 3);
  const result = verifyReceipt(receipt, { runners: registered, expect: { repo: REPO, suite: SUITE } });
  assert.deepEqual(result.reasons, []); assert.equal(result.runner.name, 'Author Box');
});

test('negatives: tampered counts, tampered output, an unregistered key, a dirty tree, an unpushed commit, a failing or empty suite and the wrong repo or suite are all refused', async () => {
  const { cwd } = await checkout(3);
  const good = await run(cwd, author, 'Author Box');
  const verify = (receipt, expect = { repo: REPO, suite: SUITE }) => verifyReceipt(receipt, { runners: registered, expect });
  const edit = change => { const copy = JSON.parse(JSON.stringify(good)); change(copy); return copy; };
  assert.match(verify(edit(copy => { copy.payload.counts.pass = 999; })).reasons.join(' '), /changed after signing/);
  assert.match(verify(edit(copy => { copy.payload.output = copy.payload.output.replace('# pass 3', '# pass 999'); })).reasons.join(' '), /does not match its hash|changed after signing/);
  assert.match(verifyReceipt(await run(cwd, stranger, 'Stranger'), { runners: registered }).reasons.join(' '), /not a registered runner/);
  assert.match(verify(good, { repo: 'someone/else', suite: SUITE }).reasons.join(' '), /someone\/else|bramroy/);
  assert.match(verify(good, { repo: REPO, suite: 'other suite' }).reasons.join(' '), /suite/);
  assert.match(verify({ payload: good.payload }).reasons.join(' '), /Not a signed receipt/);
  await writeFile(path.join(cwd, 'dirty.txt'), 'x');
  assert.match(verify(await run(cwd, author, 'Author Box')).reasons.join(' '), /not clean/);
  git(cwd, 'add', 'dirty.txt'); git(cwd, 'commit', '-qm', 'unpushed');
  assert.match(verify(await run(cwd, author, 'Author Box')).reasons.join(' '), /not on a remote branch/);
  const failing = await checkout(2); await writeFile(path.join(failing.cwd, 'suite.test.mjs'), "import test from 'node:test'; test('bad', () => { throw new Error('no'); });\n"); git(failing.cwd, 'commit', '-qam', 'bad'); git(failing.cwd, 'push', '-q', 'origin', 'main');
  assert.match(verify(await run(failing.cwd, author, 'Author Box')).reasons.join(' '), /exited with|failed tests/);
  const empty = await checkout(1); await writeFile(path.join(empty.cwd, 'suite.test.mjs'), "import test from 'node:test'; test.skip('later', () => {});\n"); git(empty.cwd, 'commit', '-qam', 'skip'); git(empty.cwd, 'push', '-q', 'origin', 'main');
  assert.match(verify(await run(empty.cwd, author, 'Author Box')).reasons.join(' '), /no passed tests/);
});

async function ledger(extra = {}) {
  const a = await new Assignments({ stateDir: await tmp('mrmak-ledger-'), openGates: true, verify: null, ...extra }).init();
  await a.registerRunner({ name: 'Author Box', role: 'author', publicKeyPem: author.publicKeyPem });
  await a.registerRunner({ name: 'Reviewer Box', role: 'reviewer', publicKeyPem: reviewer.publicKeyPem });
  return a;
}
const spec = { id: 't1', title: 'Local evidence', intent: 'the tests must really run', taskText: 'Do the thing.', owner: 'Author Box', repo: REPO, suites: [{ name: SUITE, min: 3 }] };

test('end to end with no GitHub checks: an author and a different reviewer sign real runs of the same commit, the ledger re-verifies them, and the task closes', async () => {
  const { cwd, sha } = await checkout(3);
  const a = await ledger();
  await a.assign(spec, { workerKind: 'claude' });
  await a.receipt('t1', { sha, checks: [{ name: SUITE, result: 'PASS' }], negativeSeenFailing: true });
  await a.verdict('t1', { verifier: 'chat-reviewer', sha, result: 'PASS' });
  await assert.rejects(a.close('t1'), /not verified against GitHub.*no suite has signed local runs/, 'a model report alone is not evidence');
  const authored = await run(cwd, author, 'Author Box');
  await a.localReceipt('t1', authored);
  await assert.rejects(a.close('t1'), /only Author Box \(author\) signed a passing run; an author and a different reviewer are both needed/);
  await a.localReceipt('t1', await run(cwd, reviewer, 'Reviewer Box'));
  assert.equal((await a.close('t1')).status, 'closed');
  assert.equal(a.get('t1').localReceipts.length, 2);
});

test('negatives on the ledger: unregistered, edited, wrong-commit, below-floor and reviewer-is-owner receipts do not count; revoking a runner fails a stored receipt', async () => {
  const { cwd, sha } = await checkout(3);
  const a = await ledger();
  await a.assign(spec, { workerKind: 'claude' });
  await assert.rejects(a.localReceipt('t1', await run(cwd, stranger, 'Stranger')), /not a registered runner/);
  const forged = await run(cwd, author, 'Author Box'); forged.payload.counts.pass = 50;
  await assert.rejects(a.localReceipt('t1', forged), /changed after signing|counts are not/);
  await assert.rejects(a.localReceipt('t1', await run(cwd, author, 'Author Box', { suite: 'something else' })), /not one of this task's suites/);
  // Wrong commit: the receipt is for an earlier commit than the one the task claims.
  const before = await run(cwd, author, 'Author Box'); await a.localReceipt('t1', before); await a.localReceipt('t1', await run(cwd, reviewer, 'Reviewer Box'));
  await writeFile(path.join(cwd, 'more.txt'), 'x'); git(cwd, 'add', 'more.txt'); git(cwd, 'commit', '-qm', 'more'); git(cwd, 'push', '-q', 'origin', 'main');
  const newer = git(cwd, 'rev-parse', 'HEAD');
  await a.receipt('t1', { sha: newer, checks: [{ name: SUITE, result: 'PASS' }], negativeSeenFailing: true }); await a.verdict('t1', { verifier: 'chat-reviewer', sha: newer, result: 'PASS' });
  await assert.rejects(a.close('t1'), /no suite has signed local runs/, 'runs of an older commit do not evidence a newer one');
  // Below the floor (min 3), with a 2-test suite.
  const small = await checkout(2), b = await ledger(); await b.assign(spec, { workerKind: 'claude' });
  await b.localReceipt('t1', await run(small.cwd, author, 'Author Box')); await b.localReceipt('t1', await run(small.cwd, reviewer, 'Reviewer Box'));
  await b.receipt('t1', { sha: small.sha, checks: [{ name: SUITE, result: 'PASS' }], negativeSeenFailing: true }); await b.verdict('t1', { verifier: 'chat-reviewer', sha: small.sha, result: 'PASS' });
  await assert.rejects(b.close('t1'), /no verified signed local run/, 'only 2 tests passed; 3 are required');
  // The reviewer cannot be the owner.
  const c = await ledger(); await c.assign({ ...spec, owner: 'Reviewer Box' }, { workerKind: 'claude' });
  await c.localReceipt('t1', await run(cwd, author, 'Author Box')); await c.localReceipt('t1', await run(cwd, reviewer, 'Reviewer Box'));
  await c.receipt('t1', { sha: newer, checks: [{ name: SUITE, result: 'PASS' }], negativeSeenFailing: true }); await c.verdict('t1', { verifier: 'chat-reviewer', sha: newer, result: 'PASS' });
  await assert.rejects(c.close('t1'), /only Author Box \(author\)/, 'the owner cannot also be the reviewer runner');
  // Revoking: remove the reviewer key from the registry; the stored receipt no longer verifies.
  const d = await ledger(); await d.assign(spec, { workerKind: 'claude' });
  await d.localReceipt('t1', await run(cwd, author, 'Author Box')); await d.localReceipt('t1', await run(cwd, reviewer, 'Reviewer Box'));
  await d.receipt('t1', { sha: newer, checks: [{ name: SUITE, result: 'PASS' }], negativeSeenFailing: true }); await d.verdict('t1', { verifier: 'chat-reviewer', sha: newer, result: 'PASS' });
  d.runners = d.runners.filter(runner => runner.role !== 'reviewer');
  await assert.rejects(d.close('t1'), /only Author Box \(author\)/);
  await assert.rejects(d.registerRunner({ name: 'x', role: 'boss', publicKeyPem: author.publicKeyPem }), /author or a reviewer/);
  await assert.rejects(d.registerRunner({ name: 'x', role: 'author', publicKeyPem: 'garbage' }), /not a public key/);
  await assert.rejects(a.registerRunner({ name: 'dup', role: 'author', publicKeyPem: author.publicKeyPem }), /already registered/);
  assert.equal(sha.length, 40);
});

test('a GitHub FAIL on a suite still blocks the close even when local runs pass', async () => {
  const { cwd, sha } = await checkout(3);
  const a = await ledger({ verify: async () => [{ name: SUITE, result: 'FAIL', executed: 3 }] });
  await a.assign(spec, { workerKind: 'claude' });
  await a.localReceipt('t1', await run(cwd, author, 'Author Box')); await a.localReceipt('t1', await run(cwd, reviewer, 'Reviewer Box'));
  await a.receipt('t1', { sha, checks: [{ name: SUITE, result: 'PASS' }], negativeSeenFailing: true }); await a.verdict('t1', { verifier: 'chat-reviewer', sha, result: 'PASS' });
  await assert.rejects(a.close('t1'), /FAIL or NOT RUN on GitHub.*failed/);
});

test('a real Actions check-run payload has empty output: it reads NOT RUN without the annotation step, and the count once the step publishes it', async () => {
  const payload = { id: 4242, name: SUITE, status: 'completed', conclusion: 'success', html_url: 'https://github.com/x/y/runs/4242', output: { title: null, summary: null, text: null, annotations_count: 0 } };
  const respond = runs => async url => String(url).includes('/annotations') ? { ok: true, json: async () => [{ title: 'tests-executed', message: 'pass=320 fail=0 skipped=8' }] } : { ok: true, status: 200, json: async () => ({ check_runs: runs }) };
  const without = await githubChecks({ repo: 'a/b', sha: 'deadbee1', token: 't', fetchImpl: respond([payload]) });
  assert.equal(without[0].executed, null, 'a green run says nothing about tests');
  const withStep = await githubChecks({ repo: 'a/b', sha: 'deadbee1', token: 't', fetchImpl: respond([{ ...payload, output: { ...payload.output, annotations_count: 1 } }]) });
  assert.equal(withStep[0].executed, 320);
  const a = await new Assignments({ stateDir: await tmp('mrmak-ledger-'), openGates: true, verify: async () => without }).init();
  await a.assign({ ...spec, suites: [SUITE] }, { workerKind: 'claude' });
  const receipt = await a.receipt('t1', { sha: 'deadbee1', checks: [{ name: SUITE, result: 'PASS' }], negativeSeenFailing: true });
  assert.equal(receipt.checks[0].result, 'NOT RUN');
});
