import { BrowserWindow } from 'electron'

/**
 * Office ↔ 知识库/RAG 联动。
 * 编辑器直接把文件保存在知识库目录内，保存成功后按 fileWatcher 的
 * kb-directory-changed 协议广播目录变更，触发前端刷新与 RAG 增量索引。
 */
export function notifyKnowledgeFileSaved(type, filePath, viewId) {
  const dir = filePath.replace(/[/\\][^/\\]+$/, '')
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send('kb-directory-changed', { dirs: [dir] })
    win.webContents.send('office-file-saved', { type, filePath, viewId })
  }
}
