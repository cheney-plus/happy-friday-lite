import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getDataDir } from '../config.js'
import { WebDavClient, normalizeDavPath } from './webdavClient.js'

export function shouldIgnoreVaultPath(relativePath, options = {}) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  const ignoredDirs = new Set((options.ignoredDirs || []).map(item => String(item).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')))
  if (segments.some(segment => ignoredDirs.has(segment))) return true
  for (const pattern of options.ignoredGlobs || []) {
    if (simpleGlobMatch(normalized, pattern)) return true
  }
  return false
}

export function normalizeSyncConcurrency(value) {
  const number = Math.floor(Number(value))
  if (!Number.isFinite(number)) return 4
  return Math.min(16, Math.max(1, number))
}

export async function syncObsidianSource(source, options = {}) {
  const client = options.client || new WebDavClient(source.webdav || {})
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {}
  const concurrency = normalizeSyncConcurrency(source.sync?.concurrency)
  const dataDir = options.dataDir || getDataDir()
  const targetDir = options.targetDir || getSourceTargetDir(source, dataDir)
  const statePath = getStatePath(source.id, dataDir)
  const state = readJson(statePath, { files: {} })
  const remoteRoot = normalizeDavPath(source.webdav?.remotePath || '/')
  const obsidian = source.obsidian || {}
  onProgress({ phase: 'listing', currentDir: '', filesFound: 0, visitedDirs: 0, queuedDirs: 1 })
  const entries = await listRemoteVaultFiles(client, remoteRoot, obsidian, onProgress)
  const files = entries.filter(entry => {
    if (entry.isDirectory || !entry.relativePath) return false
    if (shouldIgnoreVaultPath(entry.relativePath, obsidian)) return false
    if (obsidian.syncAttachments === false && isInConfiguredAssetDir(entry.relativePath, obsidian)) return false
    return true
  })
  const result = { success: true, downloaded: 0, skipped: 0, deleted: 0, total: files.length, targetDir, errors: [] }

  fs.mkdirSync(targetDir, { recursive: true })
  let cursor = 0
  let completed = 0

  async function worker() {
    while (cursor < files.length) {
      const index = cursor++
      const file = files[index]
      await downloadOne(file, index)
      completed += 1
    }
  }

  async function downloadOne(file, index) {
    try {
      onProgress({
        phase: 'downloading',
        current: index + 1,
        total: files.length,
        path: file.relativePath,
        downloaded: result.downloaded,
        skipped: result.skipped,
        completed,
        concurrency
      })
      const remotePath = normalizeDavPath(path.posix.join(remoteRoot, file.relativePath), { directory: false })
      const previous = state.files[file.relativePath]
      if (previous && previous.etag && previous.etag === file.etag && previous.size === file.size) {
        result.skipped += 1
        return
      }
      const buffer = await client.get(remotePath)
      const localPath = path.join(targetDir, ...file.relativePath.split('/'))
      fs.mkdirSync(path.dirname(localPath), { recursive: true })
      fs.writeFileSync(localPath, buffer)
      state.files[file.relativePath] = {
        etag: file.etag || '',
        size: file.size || buffer.length,
        lastModified: file.lastModified || '',
        hash: sha256(buffer),
        syncedAt: new Date().toISOString()
      }
      result.downloaded += 1
    } catch (e) {
      result.errors.push({ path: file.relativePath, error: e.message })
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()))
  onProgress({
    phase: 'done',
    current: files.length,
    total: files.length,
    downloaded: result.downloaded,
    skipped: result.skipped,
    errors: result.errors.length
  })

  if (source.sync?.deleteMissingRemoteFiles) {
    const remoteSet = new Set(files.map(file => file.relativePath))
    for (const relativePath of Object.keys(state.files || {})) {
      if (!remoteSet.has(relativePath)) {
        const localPath = path.join(targetDir, ...relativePath.split('/'))
        if (fs.existsSync(localPath)) {
          fs.rmSync(localPath, { force: true })
          result.deleted += 1
        }
        delete state.files[relativePath]
      }
    }
  }

  state.lastSyncAt = new Date().toISOString()
  writeJson(statePath, state)
  result.success = result.errors.length === 0
  return result
}

export async function listRemoteVaultFiles(client, remoteRoot, obsidian = {}, onProgress = () => {}) {
  const root = normalizeDavPath(remoteRoot)
  const files = []
  const dirs = ['']
  const visitedDirs = new Set()

  while (dirs.length) {
    const dir = dirs.shift()
    if (visitedDirs.has(dir)) continue
    visitedDirs.add(dir)
    onProgress({
      phase: 'listing',
      currentDir: dir || '/',
      filesFound: files.length,
      visitedDirs: visitedDirs.size,
      queuedDirs: dirs.length
    })
    const currentRemotePath = normalizeDavPath(path.posix.join(root, dir || ''))
    const entries = await client.propfind(currentRemotePath, '1')
    for (const entry of entries) {
      if (!entry.relativePath) continue
      const relativePath = path.posix.join(dir, entry.relativePath).replace(/\\/g, '/')
      if (shouldIgnoreVaultPath(relativePath, obsidian)) continue
      if (entry.isDirectory) {
        dirs.push(relativePath)
      } else {
        files.push({ ...entry, relativePath })
      }
    }
  }

  return files
}

export function getSourceTargetDir(source, dataDir = getDataDir()) {
  const categoryId = source.target?.categoryId || 'local'
  const kbName = sanitizePathSegment(source.target?.kbName || source.name || 'Obsidian Vault')
  return path.join(dataDir, 'knowledge', categoryId, kbName)
}

export function getStatePath(sourceId, dataDir = getDataDir()) {
  const dir = path.join(dataDir, 'obsidian_sync_state')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${sanitizePathSegment(sourceId)}.json`)
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (e) {
    return fallback
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function sanitizePathSegment(value) {
  return String(value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Obsidian Vault'
}

function simpleGlobMatch(value, pattern) {
  const escaped = String(pattern || '').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`).test(value)
}

function isInConfiguredAssetDir(relativePath, obsidian) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const dirs = [...(obsidian.attachmentDirs || []), ...(obsidian.imageDirs || [])]
    .map(dir => String(dir).replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
  return dirs.some(dir => normalized === dir || normalized.startsWith(dir + '/'))
}
