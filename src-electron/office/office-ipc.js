import { ipcMain } from 'electron'
import {
  openOfficeFile,
  closeOfficeFile,
  newOfficeDocument,
  hideAllOfficeViews,
  showOfficeView,
  getOfficeState,
  setOfficeToolbarHeight,
  queryOfficeDirty,
  isOfficeAvailable,
} from './office-host.js'
import { resolveEditorType } from './office-files.js'

/**
 * Vue 主界面 ↔ Office Host 的 IPC 白名单。
 * 编辑器 renderer 有各自的 preload（上游提供），这里只服务产品级 UI。
 */
export function registerOfficeIpc() {
  if (!isOfficeAvailable()) {
    console.warn('[Office] skip office IPC registration (bundles not built)')
    return
  }

  ipcMain.handle('office-open-file', (_e, { filePath }) => {
    if (typeof filePath !== 'string' || !resolveEditorType(filePath)) {
      return { success: false, error: 'unsupported file type' }
    }
    return openOfficeFile(filePath)
  })

  ipcMain.handle('office-close', (_e, { type }) => closeOfficeFile(type))

  ipcMain.handle('office-new', (_e, { type }) => {
    if (!['docs', 'sheets', 'slides', 'pdf'].includes(type)) {
      return { success: false, error: 'unsupported editor type' }
    }
    return newOfficeDocument(type)
  })

  ipcMain.handle('office-hide-all', () => {
    hideAllOfficeViews()
    return { success: true }
  })

  ipcMain.handle('office-show', (_e, { type }) => showOfficeView(type))

  ipcMain.handle('office-get-state', () => getOfficeState())

  ipcMain.handle('office-set-toolbar-height', (_e, { height }) => {
    setOfficeToolbarHeight(height)
    return { success: true }
  })

  ipcMain.handle('office-is-dirty', (_e, { type }) => queryOfficeDirty(type))
}
