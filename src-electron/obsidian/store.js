import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getDataDir } from '../config.js'
import { getSourceTargetDir, normalizeSyncConcurrency } from './sync.js'

const FILE_NAME = 'obsidian_sources.json'

export function defaultObsidianSource(overrides = {}) {
  const name = overrides.name || 'Obsidian Vault'
  return normalizeSource({
    id: overrides.id || crypto.randomUUID(),
    name,
    enabled: overrides.enabled !== false,
    webdav: {
      url: '',
      username: '',
      password: '',
      remotePath: '/',
      ...(overrides.webdav || {})
    },
    target: {
      categoryId: 'local',
      kbName: name,
      ...(overrides.target || {})
    },
    sync: {
      scheduleEnabled: false,
      syncOnStartup: false,
      intervalMinutes: 60,
      concurrency: 4,
      deleteMissingRemoteFiles: false,
      ...(overrides.sync || {})
    },
    obsidian: {
      ignoredDirs: ['.obsidian', '.trash'],
      ignoredGlobs: [],
      attachmentDirs: ['attachments'],
      imageDirs: ['images'],
      syncAttachments: true,
      ragIncludeAttachments: false,
      ragIncludeImages: false,
      bidirectionalWriteBack: false,
      ...(overrides.obsidian || {})
    },
    status: overrides.status || {}
  })
}

export function listObsidianSources() {
  return readStore().sources.map(normalizeSource)
}

export function saveObsidianSource(source) {
  const store = readStore()
  const normalized = defaultObsidianSource(source || {})
  const index = store.sources.findIndex(item => item.id === normalized.id)
  if (index >= 0) store.sources[index] = normalized
  else store.sources.push(normalized)
  writeStore(store)
  return normalized
}

export function deleteObsidianSource(id) {
  const store = readStore()
  const before = store.sources.length
  store.sources = store.sources.filter(source => source.id !== id)
  writeStore(store)
  return before !== store.sources.length
}

export function getObsidianSource(id) {
  return listObsidianSources().find(source => source.id === id) || null
}

export function updateObsidianSourceStatus(id, status) {
  const source = getObsidianSource(id)
  if (!source) return null
  return saveObsidianSource({ ...source, status: { ...(source.status || {}), ...(status || {}) } })
}

export function findObsidianSourceForFile(filePath) {
  const dataDir = getDataDir()
  const normalizedFilePath = path.resolve(filePath || '')
  return listObsidianSources().find(source => {
    const targetDir = path.resolve(getSourceTargetDir(source, dataDir))
    return normalizedFilePath === targetDir || normalizedFilePath.startsWith(targetDir + path.sep)
  }) || null
}

function normalizeSource(source) {
  const normalized = {
    ...source,
    webdav: { ...(source.webdav || {}) },
    target: { categoryId: 'local', ...(source.target || {}) },
    sync: { ...(source.sync || {}) },
    obsidian: { ...(source.obsidian || {}) },
    status: { ...(source.status || {}) }
  }
  normalized.target.kbName = normalized.target.kbName || normalized.name || 'Obsidian Vault'
  normalized.sync.intervalMinutes = Math.max(5, Number(normalized.sync.intervalMinutes) || 60)
  normalized.sync.concurrency = normalizeSyncConcurrency(normalized.sync.concurrency)
  normalized.obsidian.bidirectionalWriteBack = normalized.obsidian.bidirectionalWriteBack === true
  normalized.obsidian.ignoredDirs = normalizeList(normalized.obsidian.ignoredDirs)
  normalized.obsidian.ignoredGlobs = normalizeList(normalized.obsidian.ignoredGlobs)
  normalized.obsidian.attachmentDirs = normalizeList(normalized.obsidian.attachmentDirs)
  normalized.obsidian.imageDirs = normalizeList(normalized.obsidian.imageDirs)
  return normalized
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean)
  if (!value) return []
  return String(value).split(/[\n,]+/).map(item => item.trim()).filter(Boolean)
}

function getStorePath() {
  const dataDir = getDataDir()
  if (!dataDir) throw new Error('Data directory not initialized')
  return path.join(dataDir, FILE_NAME)
}

function readStore() {
  const storePath = getStorePath()
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
    return { sources: Array.isArray(parsed.sources) ? parsed.sources : [] }
  } catch (e) {
    return { sources: [] }
  }
}

function writeStore(store) {
  const storePath = getStorePath()
  fs.mkdirSync(path.dirname(storePath), { recursive: true })
  fs.writeFileSync(storePath, JSON.stringify({ sources: store.sources || [] }, null, 2), 'utf-8')
}
