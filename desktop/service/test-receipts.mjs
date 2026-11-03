import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import os from 'node:os';

// A signed local test receipt: the evidence source for a studio with no paid CI. A runner (a person's or reviewer's machine)
// runs the suite on a clean, pushed commit and signs what happened: the commit, the command, the raw output and the counts parsed
// from it. The owner registers each runner's public key and role. The ledger re-parses the stored output, so a claimed count that
// the output does not show is refused, and it needs an author runner AND a different reviewer runner to agree on the same commit.
const MAX_OUTPUT = 4 * 1024 * 1024;
const sha256 = value => createHash('sha256').update(value).digest('hex');
export const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
export const fingerprint = publicKeyPem => sha256(createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' }));

export function generateRunnerKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  return { publicKeyPem, privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }), fingerprint: fingerprint(publicKeyPem) };
}

// Counts as the runner printed them (node:test TAP "# pass 12" or its spec reporter "ℹ pass 12"). The last of each is the summary.
export function parseCounts(text) {
  const counts = { tests: null, pass: null, fail: null, skipped: null };
  for (const key of Object.keys(counts)) for (const match of String(text).matchAll(new RegExp(`^\\W*(?:#|ℹ)\\s*${key}\\s+(\\d+)\\s*$`, 'gim'))) counts[key] = Number(match[1]);
  return counts;
}

const git = (cwd, args) => new Promise(resolve => execFile('git', args, { cwd, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => resolve(error ? null : String(stdout).trim())));

// Run the suite here and sign the result. The tree must be clean and the commit pushed, or the receipt says so and is refused later.
export async function runReceipt({ cwd, repo, suite, command, privateKeyPem, runner, env = process.env }) {
  const startedAt = new Date().toISOString();
  const sha = await git(cwd, ['rev-parse', 'HEAD']);
  if (!sha) throw new Error('This folder is not a git repository with a commit.');
  const treeClean = (await git(cwd, ['status', '--porcelain'])) === '';
  const pushed = !!(await git(cwd, ['branch', '-r', '--contains', sha]));
  const { output, exitCode } = await new Promise(resolve => {
    const clean = { ...env, CI: '1', NO_COLOR: '1' }; delete clean.NODE_TEST_CONTEXT; // A runner started inside another node:test run must still print its own summary.
    const child = spawn(command, { cwd, shell: true, env: clean });
    let output = '';
    const take = data => { if (output.length < MAX_OUTPUT) output += String(data); };
    child.stdout.on('data', take); child.stderr.on('data', take);
    child.on('error', error => resolve({ output: `${output}\n${error.message}`, exitCode: -1 }));
    child.on('close', code => resolve({ output, exitCode: code ?? -1 }));
  });
  const payload = { version: 1, repo, suite, command, sha, clean: treeClean, pushed, exitCode, output, outputSha256: sha256(output), counts: parseCounts(output), runner, host: os.hostname(), startedAt, finishedAt: new Date().toISOString() };
  const key = createPrivateKey(privateKeyPem);
  return { payload, publicKey: createPublicKey(key).export({ type: 'spki', format: 'pem' }), signature: sign(null, Buffer.from(canonical(payload)), key).toString('base64') };
}

// Re-verify a receipt from scratch against the registered runners. Nothing in it is trusted but the signature of a registered key.
// runners: [{ name, role, publicKeyPem }]. expect: { repo, suite }.
export function verifyReceipt(receipt, { runners = [], expect = {} } = {}) {
  const reasons = [];
  const payload = receipt?.payload;
  if (!payload || typeof receipt.signature !== 'string' || typeof receipt.publicKey !== 'string') return { ok: false, reasons: ['Not a signed receipt.'] };
  let print, signed = false;
  try { print = fingerprint(receipt.publicKey); signed = verify(null, Buffer.from(canonical(payload)), createPublicKey(receipt.publicKey), Buffer.from(receipt.signature, 'base64')); } catch { reasons.push('The signature or key is malformed.'); }
  const runner = runners.find(item => { try { return fingerprint(item.publicKeyPem) === print; } catch { return false; } });
  if (print && !signed) reasons.push('The signature does not match the receipt (it was changed after signing).');
  if (print && !runner) reasons.push('The signing key is not a registered runner. The owner registers runners.');
  if (typeof payload.output !== 'string' || sha256(payload.output) !== payload.outputSha256) reasons.push('The stored output does not match its hash.');
  const counts = typeof payload.output === 'string' ? parseCounts(payload.output) : {};
  if (canonical(counts) !== canonical(payload.counts)) reasons.push('The claimed counts are not what the stored output shows.');
  if (payload.exitCode !== 0) reasons.push(`The command exited with ${payload.exitCode}.`);
  if (!Number.isInteger(counts.pass) || counts.pass < 1) reasons.push('The output shows no passed tests.');
  if (counts.fail) reasons.push(`The output shows ${counts.fail} failed tests.`);
  if (!/^[0-9a-f]{7,40}$/i.test(String(payload.sha || ''))) reasons.push('No exact commit ID.');
  if (payload.clean !== true) reasons.push('The working tree was not clean, so the run is not of the commit.');
  if (payload.pushed !== true) reasons.push('The commit was not on a remote branch, so a reviewer cannot get it.');
  if (expect.repo && payload.repo !== expect.repo) reasons.push(`The receipt is for ${payload.repo}, not ${expect.repo}.`);
  if (expect.suite && payload.suite !== expect.suite) reasons.push(`The receipt is for suite "${payload.suite}", not "${expect.suite}".`);
  return { ok: !reasons.length, reasons, runner: runner ? { name: runner.name, role: runner.role, fingerprint: print } : null, counts };
}
