// The desktop service tests import the real service, which needs its own node_modules (ws, node-pty and others).
// A fresh clone has none, and a test that cannot load its dependencies is NOT RUN, which is not a pass.
// So the test scripts install them first, and fail loudly if they cannot.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const service = path.join(root, 'desktop', 'service');
const needed = ['ws', 'node-pty'].filter(name => !existsSync(path.join(service, 'node_modules', name)));
if (needed.length) {
  console.log(`desktop/service is missing ${needed.join(', ')}; running npm ci there.`);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['--prefix', service, 'ci'], { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' });
  if (result.status !== 0) { console.error('npm ci failed in desktop/service. The service tests cannot run: that is NOT RUN, not a pass.'); process.exit(result.status || 1); }
}
const still = ['ws'].filter(name => !existsSync(path.join(service, 'node_modules', name)));
if (still.length) { console.error(`desktop/service still lacks ${still.join(', ')}. The service tests cannot run: NOT RUN, not a pass.`); process.exit(1); }
