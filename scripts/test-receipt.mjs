#!/usr/bin/env node
// Run a test suite on a clean, pushed commit and print a signed receipt (JSON) for the Mr. Mak ledger.
//   node scripts/test-receipt.mjs keygen > runner.key.json          (once per runner; give the public key to the owner to register)
//   node scripts/test-receipt.mjs run --key runner.key.json --runner "Name" --repo owner/name --suite "service tests" \
//        --cwd <checkout> -- <test command>  > receipt.json
// An author runs it, and a different reviewer runs it with their own key. Keep the private key off the repo.
import { readFile } from 'node:fs/promises';
import { generateRunnerKey, runReceipt, parseCounts } from '../desktop/service/test-receipts.mjs';

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'keygen') { console.log(JSON.stringify(generateRunnerKey(), null, 2)); process.exit(0); }
if (mode !== 'run') { console.error('Usage: test-receipt.mjs keygen | run --key FILE --runner NAME --repo owner/name --suite NAME [--cwd DIR] -- COMMAND'); process.exit(2); }
const split = rest.indexOf('--'); const flags = split < 0 ? rest : rest.slice(0, split), command = split < 0 ? '' : rest.slice(split + 1).join(' ');
const flag = name => { const at = flags.indexOf(`--${name}`); return at >= 0 ? flags[at + 1] : undefined; };
for (const name of ['key', 'runner', 'repo', 'suite']) if (!flag(name)) { console.error(`Missing --${name}`); process.exit(2); }
if (!command) { console.error('Missing the test command after --'); process.exit(2); }
const key = JSON.parse(await readFile(flag('key'), 'utf8'));
const receipt = await runReceipt({ cwd: flag('cwd') || process.cwd(), repo: flag('repo'), suite: flag('suite'), command, privateKeyPem: key.privateKeyPem, runner: flag('runner') });
const { counts, sha, clean, pushed, exitCode } = receipt.payload;
console.error(`commit ${sha.slice(0, 8)} · clean ${clean} · pushed ${pushed} · exit ${exitCode} · passed ${counts.pass} failed ${counts.fail} skipped ${counts.skipped}`);
console.log(JSON.stringify(receipt));
process.exit(0);
