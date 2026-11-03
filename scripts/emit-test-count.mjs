#!/usr/bin/env node
// For a GitHub Actions test step: publish the passed-test count where the ledger can read it (a check-run annotation).
//   node --test ... 2>&1 | tee test.out; node scripts/emit-test-count.mjs < test.out
import { parseCounts } from '../desktop/service/test-receipts.mjs';
let text = ''; for await (const chunk of process.stdin) text += chunk;
const counts = parseCounts(text);
if (!Number.isInteger(counts.pass)) { console.log('::error title=tests-executed::no test summary in the output'); process.exit(1); }
console.log(`::notice title=tests-executed::pass=${counts.pass} fail=${counts.fail ?? 0} skipped=${counts.skipped ?? 0}`);
