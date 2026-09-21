import { ipcMain } from 'electron'
import {
  openOfficeFile,
  closeOfficeFile,
  autoSaveOfficeFile,
  newOfficeDocument,
  hideAllOfficeViews,
  showOfficeView,
  getOfficeState,
  setOfficeContentBounds,
  getOfficeRecents,
  toggleOfficeStarred,
  removeOfficeRecents,
  revealOfficePath,
  openOfficeFileDialog,
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

  ipcMain.handle('office-open-file', (_e, { filePath, viewId } = {}) => {
    if (typeof filePath !== 'string' || !resolveEditorType(filePath)) {
      return { success: false, error: 'unsupported file type' }
    }
    return openOfficeFile(filePath, { viewId })
  })

  ipcMain.handle('office-close', (_e, { viewId } = {}) => closeOfficeFile(viewId))

  // 关闭编辑器 Tab 前自动保存：触发编辑器保存并等待落盘（不再弹确认框）
  ipcMain.handle('office-auto-save', (_e, { viewId } = {}) => {
    if (typeof viewId !== 'string') {
      return { success: false, error: 'unsupported editor type' }
    }
    return autoSaveOfficeFile(viewId)
  })

  ipcMain.handle('office-new', (_e, { type, viewId } = {}) => {
    if (!['docs', 'sheets', 'slides', 'pdf'].includes(type)) {
      return { success: false, error: 'unsupported editor type' }
    }
    return newOfficeDocument(type, viewId)
  })

  ipcMain.handle('office-hide-all', () => {
    hideAllOfficeViews()
    return { success: true }
  })

  ipcMain.handle('office-show', (_e, { viewId } = {}) => showOfficeView(viewId))

  ipcMain.handle('office-get-state', () => getOfficeState())

  ipcMain.handle('office-set-content-bounds', (_e, rect) => {
    setOfficeContentBounds(rect)
    return { success: true }
  })

  ipcMain.handle('office-get-recents', () => getOfficeRecents())

  ipcMain.handle('office-toggle-starred', (_e, filePath) => toggleOfficeStarred(filePath))

  ipcMain.handle('office-remove-recents', (_e, filePaths) => removeOfficeRecents(filePaths))

  ipcMain.handle('office-reveal-path', (_e, filePath) => revealOfficePath(filePath))

  ipcMain.handle('office-open-dialog', () => openOfficeFileDialog())

  ipcMain.handle('office-is-dirty', (_e, { viewId } = {}) => queryOfficeDirty(viewId))
}
