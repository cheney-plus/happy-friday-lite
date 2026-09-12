import { listObsidianSources, updateObsidianSourceStatus } from './store.js'
import { syncObsidianSource } from './sync.js'

const timers = new Map()
let sender = null

export function startObsidianScheduler(mainWindow) {
  sender = mainWindow
  reloadObsidianScheduler()
  for (const source of listObsidianSources()) {
    if (source.enabled && source.sync?.syncOnStartup) {
      runScheduledSync(source.id)
    }
  }
}

export function stopObsidianScheduler() {
  for (const timer of timers.values()) clearInterval(timer)
  timers.clear()
  sender = null
}

export function reloadObsidianScheduler() {
  for (const timer of timers.values()) clearInterval(timer)
  timers.clear()
  for (const source of listObsidianSources()) {
    if (!source.enabled || !source.sync?.scheduleEnabled) continue
    const intervalMs = Math.max(5, Number(source.sync.intervalMinutes) || 60) * 60 * 1000
    timers.set(source.id, setInterval(() => runScheduledSync(source.id), intervalMs))
  }
}

export async function runScheduledSync(sourceId) {
  const source = listObsidianSources().find(item => item.id === sourceId)
  if (!source || !source.enabled) return null
  return runObsidianSync(source)
}

export async function runObsidianSync(source) {
  updateObsidianSourceStatus(source.id, { syncing: true, lastError: '' })
  notify('obsidian-sync-status', { sourceId: source.id, syncing: true })
  try {
    const result = await syncObsidianSource(source, {
      onProgress: progress => notify('obsidian-sync-status', {
        sourceId: source.id,
        syncing: true,
        progress
      })
    })
    updateObsidianSourceStatus(source.id, {
      syncing: false,
      lastSyncAt: new Date().toISOString(),
      lastResult: result,
      lastError: result.success ? '' : 'Some files failed to sync'
    })
    notify('obsidian-sync-status', { sourceId: source.id, syncing: false, result })
    notify('kb-directory-changed', { path: result.targetDir, reason: 'obsidian-sync' })
    return result
  } catch (e) {
    const status = { syncing: false, lastError: e.message, lastSyncAt: new Date().toISOString() }
    updateObsidianSourceStatus(source.id, status)
    notify('obsidian-sync-status', { sourceId: source.id, ...status })
    return { success: false, error: e.message }
  }
}

function notify(channel, payload) {
  if (sender && !sender.isDestroyed()) sender.webContents.send(channel, payload)
}
