// File: desktop/service/test/brand-assets.test.mjs
// Purpose: Check bundled Mr. Mak branding without requiring a prior Vite build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfigFromFile } from 'vite';

const root = path.resolve(import.meta.dirname, '../../..');

test('Vite registers first-party app assets without copying the huge workspace junction', async () => {
  // Checks runs npm test on a fresh checkout where dist/ does not exist.
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'test', isSsrBuild: false, isPreview: false },
    path.join(root, 'vite.config.ts'),
  );
  assert.ok(loaded, 'Vite config should load independently of dist/');
  assert.equal(loaded.config.build?.copyPublicDir, false);
  const plugins = (loaded.config.plugins || []).flat(Infinity);
  const plugin = plugins.find(item => item?.name === 'mrmak-brand-assets');
  assert.ok(plugin, 'asset plugin must be registered');

  const emitted = [];
  const context = { emitFile(asset) { emitted.push(asset); return String(emitted.length); } };
  assert.equal(typeof plugin.generateBundle, 'function');
  await plugin.generateBundle.call(context, {}, {}, false);

  const names = ['mak-nose.svg', 'mak-nose-chats.svg', 'mak-mobile-192.png', 'mak-mobile-512.png'];
  assert.deepEqual(emitted.map(item => item.fileName), names.map(name => 'assets/' + name));
  for (const asset of emitted) {
    assert.equal(asset.type, 'asset');
    const original = await readFile(path.join(root, 'public', asset.fileName));
    assert.deepEqual(Buffer.from(asset.source), original, asset.fileName);
  }
});
