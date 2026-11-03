#!/usr/bin/env node
// For a GitHub Actions test step: publish the passed-test count where the Mr. Mak ledger can read it (a check-run annotation).
// Standalone, so the same file can be copied into any repository.
//   node --test ... 2>&1 | tee test.out; node scripts/emit-test-count.mjs < test.out
let text = ''; for await (const chunk of process.stdin) text += chunk;
const last = key => { let value = null; for (const match of text.matchAll(new RegExp(`^\\W*(?:#|\u2139)\\s*${key}\\s+(\\d+)\\s*$`, 'gim'))) value = Number(match[1]); return value; };
const pass = last('pass');
if (!Number.isInteger(pass)) { console.log('::error title=tests-executed::no test summary in the output'); process.exit(1); }
console.log(`::notice title=tests-executed::pass=${pass} fail=${last('fail') ?? 0} skipped=${last('skipped') ?? 0}`);
