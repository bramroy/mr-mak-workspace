// File: desktop/service/test/bob-native-acl.test.mjs
// Purpose: Guard the Tauri ACL boundary observed in the Windows smoke test.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')
test('Only the local Chats webview has the native Bob command capability', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'))
  const cap = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/capabilities/bob-native.json'), 'utf8'))
  const build = fs.readFileSync(path.join(root, 'src-tauri/build.rs'), 'utf8')
  const main = fs.readFileSync(path.join(root, 'src-tauri/src/main.rs'), 'utf8')

  assert.deepEqual(config.app.security.capabilities, ['bob-native-from-local-chats'])
  assert.equal(cap.identifier, 'bob-native-from-local-chats')
  assert.deepEqual(cap.webviews, ['chats'])
  assert.equal('windows' in cap, false, 'grant the trusted Chats view, not the whole parent window')
  assert.equal(cap.local, false, 'avoid silently expanding privileges to all bundled/local views')
  assert.deepEqual(cap.remote.urls, ['http://127.0.0.1:*/*'])
  assert.deepEqual(cap.permissions, ['allow-bob-native'])
  assert.match(build, /AppManifest::new\(\)\.commands\(&\["bob_native"\]\)/)
  assert.match(main, /generate_handler!\[bob_tabs::bob_native\]/)
  assert.doesNotMatch(JSON.stringify(cap), /chatgpt\.com|https:\/\//, 'do not enable IPC from ChatGPT')
})
