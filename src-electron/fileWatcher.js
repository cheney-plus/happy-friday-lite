/**
 * 知识库文件系统监听器
 * ============================================
 * 监听 {dataDir}/knowledge/ 目录下的文件变化，
 * 通过 kb-directory-changed 事件通知渲染进程。
 *
 * 设计要点（平衡性能与实时性）：
 *   - 使用 fs.watch 原生 API，避免引入额外依赖
 *   - macOS/Windows 启用 recursive 递归监听整个 knowledge 目录
 *   - Linux 不支持 recursive，降级为监听根目录 + 各分类一级子目录
 *   - 防抖 300ms 聚合批量事件（文件系统操作经常触发大量连续事件）
 *   - 通知"发生变化的精确目录路径"（去重），由渲染进程决定是否刷新当前视图
 *   - 应用退出时关闭所有 watcher，避免句柄泄漏
 */

import fs from 'fs'
import path from 'path'
import { KB_DIRECTORY_CHANGED } from './events.js'

const DEBOUNCE_MS = 300

/**
 * 启动知识库目录监听
 * @param {BrowserWindow} mainWindow 主窗口实例，用于向渲染进程发送事件
 * @param {string} dataDir 应用数据目录（监听其下的 knowledge/ 子目录）
 * @returns {{ close: () => void }} 返回关闭句柄
 */
export function startKnowledgeWatcher(mainWindow, dataDir) {
  const knowledgeRoot = path.join(dataDir, 'knowledge')

  // 确保目录存在
  if (!fs.existsSync(knowledgeRoot)) {
    try {
      fs.mkdirSync(knowledgeRoot, { recursive: true })
    } catch (e) {
      console.error('[FileWatcher] 创建 knowledge 目录失败:', e)
      return { close: () => {} }
    }
  }

  const watchers = []
  const changedDirs = new Set() // 防抖期间聚合的变更目录（精确路径，去重）
  let debounceTimer = null

  /**
   * 触发防抖：聚合 DEBOUNCE_MS 内的所有变更目录，一次性通知渲染进程
   * @param {string} changedDir 发生变更的目录绝对路径
   */
  function scheduleNotify(changedDir) {
    changedDirs.add(changedDir)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const dirs = Array.from(changedDirs)
      changedDirs.clear()
      debounceTimer = null
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(KB_DIRECTORY_CHANGED, { dirs })
      }
    }, DEBOUNCE_MS)
  }

  /**
   * 创建单个目录的 watcher
   */
  function watchDir(dirPath, recursive) {
    try {
      const watcher = fs.watch(dirPath, { recursive }, (eventType, filename) => {
        // filename 在 recursive 模式下可能是相对路径（含分隔符）
        // 忽略隐藏文件/临时文件（. 开头）
        if (filename && filename.split(path.sep).some(seg => seg.startsWith('.'))) {
          return
        }
        // 计算变更发生的实际目录（变更文件的父目录）
        // - recursive 模式：filename 可能含子路径，取其父目录
        // - 非 recursive：变更就在 dirPath 本身
        let changedDir = dirPath
        if (filename && filename.includes(path.sep)) {
          const parentRel = filename.split(path.sep).slice(0, -1).join(path.sep)
          if (parentRel) {
            const candidate = path.join(dirPath, parentRel)
            if (fs.existsSync(candidate)) {
              changedDir = candidate
            }
          }
        }
        scheduleNotify(changedDir)
      })
      watcher.on('error', err => {
        // watcher 错误不应导致进程崩溃
        console.warn('[FileWatcher] watcher error:', err?.message || err)
      })
      watchers.push(watcher)
    } catch (e) {
      // 某些平台不支持 recursive，会抛错；这里仅记录不阻断
      console.warn(`[FileWatcher] 监听 ${dirPath} (recursive=${recursive}) 失败:`, e?.message || e)
    }
  }

  // 平台检测：macOS / Windows 支持 recursive，Linux 不支持
  const supportsRecursive = process.platform === 'darwin' || process.platform === 'win32'

  if (supportsRecursive) {
    // 单个递归 watcher 覆盖整个 knowledge 目录
    watchDir(knowledgeRoot, true)
  } else {
    // Linux 降级：监听 knowledgeRoot + 各分类一级子目录
    watchDir(knowledgeRoot, false)
    try {
      const entries = fs.readdirSync(knowledgeRoot, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          watchDir(path.join(knowledgeRoot, entry.name), false)
        }
      }
    } catch (e) {
      console.warn('[FileWatcher] 读取 knowledge 子目录失败:', e?.message || e)
    }
  }

  console.log(`[FileWatcher] ✅ 已启动 knowledge 目录监听: ${knowledgeRoot} (recursive=${supportsRecursive})`)

  return {
    close() {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      changedDirs.clear()
      for (const w of watchers) {
        try { w.close() } catch (_e) { /* 忽略 */ }
      }
      watchers.length = 0
      console.log('[FileWatcher] 已停止 knowledge 目录监听')
    }
  }
}
