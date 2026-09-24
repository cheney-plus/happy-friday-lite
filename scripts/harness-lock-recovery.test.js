import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { clearHarnessCredentialLock } from '../src-electron/harness/lockRecovery.js'

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-lock-'))
  const filename = path.join(directory, '.credentials.yaml')
  const lockPath = `${filename}.lock`
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return { filename, lockPath }
}

test('removes the DSH credentials writer lock regardless of recorded PID', t => {
  const { filename, lockPath } = fixture(t)
  fs.writeFileSync(lockPath, `${process.pid}\n`)
  assert.equal(clearHarnessCredentialLock(filename), true)
  assert.equal(fs.existsSync(lockPath), false)
})

test('does nothing when the writer lock does not exist', t => {
  const { filename } = fixture(t)
  assert.equal(clearHarnessCredentialLock(filename), false)
})

test('does not hide errors other than a missing lock', t => {
  const { filename, lockPath } = fixture(t)
  fs.mkdirSync(lockPath)
  assert.throws(() => clearHarnessCredentialLock(filename), error => error?.code === 'EISDIR')
})
