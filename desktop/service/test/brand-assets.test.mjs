// File: desktop/service/test/brand-assets.test.mjs
// Purpose: The source-mode build must supply the same logos as the installed bundle.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const repo = path.resolve(import.meta.dirname, '../../..')
test('Vite ships first-party brand assets without copying the large workspace junction', async () => {
  for (const name of ['mak-nose.svg', 'mak-nose-chats.svg', 'mak-mobile-192.png', 'mak-mobile-512.png']) {
    const original = await readFile(path.join(repo, 'public/assets', name))
    const built = await readFile(path.join(repo, 'dist/assets', name))
    assert.deepEqual(built, original, name + ' should be identical in the source-mode and bundled UI')
  }
})
