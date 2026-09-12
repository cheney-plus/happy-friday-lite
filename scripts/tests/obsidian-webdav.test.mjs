import test from 'node:test'
import assert from 'node:assert/strict'

import { parsePropfindXml, normalizeDavPath } from '../../src-electron/obsidian/webdavClient.js'
import { normalizeSyncConcurrency, shouldIgnoreVaultPath } from '../../src-electron/obsidian/sync.js'

test('parses WebDAV multistatus response', () => {
  const xml = `<?xml version="1.0"?>
  <d:multistatus xmlns:d="DAV:">
    <d:response>
      <d:href>/dav/vault/</d:href>
      <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
    </d:response>
    <D:response>
      <D:href>/dav/vault/Note%201.md</D:href>
      <D:propstat><D:prop>
        <D:getetag>"abc"</D:getetag>
        <D:getlastmodified>Sat, 12 Sep 2026 02:00:00 GMT</D:getlastmodified>
        <D:getcontentlength>42</D:getcontentlength>
      </D:prop></D:propstat>
    </D:response>
  </d:multistatus>`

  const entries = parsePropfindXml(xml, '/dav/vault/')
  assert.equal(entries.length, 2)
  assert.equal(entries[0].isDirectory, true)
  assert.equal(entries[1].relativePath, 'Note 1.md')
  assert.equal(entries[1].etag, '"abc"')
  assert.equal(entries[1].size, 42)
})

test('normalizes WebDAV paths and ignore rules', () => {
  assert.equal(normalizeDavPath('vault/sub'), '/vault/sub/')
  assert.equal(normalizeDavPath('/vault/file.md', { directory: false }), '/vault/file.md')
  assert.equal(shouldIgnoreVaultPath('.obsidian/workspace.json', { ignoredDirs: ['.obsidian'] }), true)
  assert.equal(shouldIgnoreVaultPath('notes/demo.md', { ignoredDirs: ['.obsidian'] }), false)
})

test('normalizes sync concurrency with default and max limit', () => {
  assert.equal(normalizeSyncConcurrency(undefined), 4)
  assert.equal(normalizeSyncConcurrency(0), 1)
  assert.equal(normalizeSyncConcurrency(8), 8)
  assert.equal(normalizeSyncConcurrency(99), 16)
})
