import { initOfficeHost, openOfficeFile, closeOfficeFile, hideAllOfficeViews, showOfficeView, getOfficeState, setOfficeToolbarHeight, queryOfficeDirty, onOfficeFileSaved, shutdownOfficeHost } from './office-host.js'
import { notifyKnowledgeFileSaved } from './office-knowledge.js'

/**
 * Office 会话管理：把 host 事件接到知识库/RAG 联动，并提供崩溃恢复记录。
 */
export { initOfficeHost, openOfficeFile, closeOfficeFile, hideAllOfficeViews, showOfficeView, getOfficeState, setOfficeToolbarHeight, queryOfficeDirty, shutdownOfficeHost }

/** 应用启动时安装 Office 会话钩子（保存 → 知识库刷新） */
export function initOfficeSession(mainWindow) {
  onOfficeFileSaved((type, filePath) => {
    try {
      notifyKnowledgeFileSaved(type, filePath)
    } catch (e) {
      console.warn('[Office] knowledge notify failed:', e?.message || e)
    }
  })
  return initOfficeHost(mainWindow)
}
