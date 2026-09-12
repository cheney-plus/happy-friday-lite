import path from 'path'
import electron from 'electron'
import {
  defaultObsidianSource,
  deleteObsidianSource,
  findObsidianSourceForFile,
  getObsidianSource,
  listObsidianSources,
  saveObsidianSource
} from './store.js'
import { WebDavClient } from './webdavClient.js'
import { getSourceTargetDir } from './sync.js'
import { reloadObsidianScheduler, runObsidianSync } from './scheduler.js'
import { transformMarkdownFile } from './parser.js'
import { getDataDir } from '../config.js'

const { ipcMain } = electron

export function registerObsidianCommands() {
  ipcMain.handle('obsidian-list-sources', () => {
    return { success: true, sources: listObsidianSources() }
  })

  ipcMain.handle('obsidian-new-source-template', () => {
    return { success: true, source: defaultObsidianSource() }
  })

  ipcMain.handle('obsidian-save-source', (_event, args) => {
    const source = saveObsidianSource(args?.source || args || {})
    reloadObsidianScheduler()
    return { success: true, source }
  })

  ipcMain.handle('obsidian-delete-source', (_event, args) => {
    const deleted = deleteObsidianSource(args?.id)
    reloadObsidianScheduler()
    return { success: true, deleted }
  })

  ipcMain.handle('obsidian-test-connection', async (_event, args) => {
    const source = defaultObsidianSource(args?.source || args || {})
    try {
      const client = new WebDavClient(source.webdav)
      await client.propfind(source.webdav.remotePath || '/', '1')
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('obsidian-sync-now', async (_event, args) => {
    const source = args?.source ? saveObsidianSource(args.source) : getObsidianSource(args?.id)
    if (!source) return { success: false, error: 'Source not found' }
    const result = await runObsidianSync(source)
    return result
  })

  ipcMain.handle('obsidian-render-markdown', async (_event, args) => {
    const filePath = args?.filePath
    if (!filePath) return { success: false, error: 'Missing filePath' }
    try {
      const source = findObsidianSourceForFile(filePath)
      const rootDir = source ? getSourceTargetDir(source, getDataDir()) : path.dirname(filePath)
      const obsidian = source?.obsidian || {}
      const result = await transformMarkdownFile(filePath, {
        rootDir,
        attachmentDirs: obsidian.attachmentDirs,
        imageDirs: obsidian.imageDirs
      })
      return { success: true, ...result }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })
}
