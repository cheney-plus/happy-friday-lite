/**
 * 知识库文件系统监听器
 * ============================================
 * 监听 {dataDir}/knowledge/ 目录下的文件变化，
 * 通过 kb-directory-changed 事件通知渲染进程。
 *
 * 设计要点（平衡性能与实时性）：
 *   - 使用 fs.watch 原生 API，避免引入额外依赖
 *   - macOS/Windows 启用 recursive 递归监听整个 knowledge 目录
 *   - Linux 不支持 recursive，降级为：
 *       a) 静态监听 knowledgeRoot + 各分类一级子目录（捕获知识库列表变化）
 *       b) 动态监听前端当前浏览目录（捕获当前目录内容变化）
 *   - 防抖 300ms 聚合批量事件（文件系统操作经常触发大量连续事件）
 *   - 通知"发生变化的精确目录路径"（去重），由渲染进程决定是否刷新当前视图
 *   - 路径分隔符统一规范化为 '/'，确保跨平台路径比较一致
 *   - 应用退出时关闭所有 watcher，避免句柄泄漏
 */

import fs from 'fs'
import path from 'path'
import { KB_DIRECTORY_CHANGED } from './events.js'

const DEBOUNCE_MS = 300

/**
 * 将路径分隔符统一规范化为 '/'，便于跨平台比较
 * （前端用 '/' 拼接路径，后端 path.join 在 Windows 上用 '\\'，需统一）
 */
function normalizePath(p) {
  if (!p) return p
  return p.replace(/\\/g, '/')
}

/**
 * 启动知识库目录监听
 * @param {BrowserWindow} mainWindow 主窗口实例，用于向渲染进程发送事件
 * @param {string} dataDir 应用数据目录（监听其下的 knowledge/ 子目录）
 * @returns {{ close: () => void, watchCurrentDir: (dirPath: string) => void }} 返回控制句柄
 */
export function startKnowledgeWatcher(mainWindow, dataDir) {
  const knowledgeRoot = path.join(dataDir, 'knowledge')

  // 平台检测：macOS / Windows 支持 recursive，Linux 不支持
  const supportsRecursive = process.platform === 'darwin' || process.platform === 'win32'

  // 确保目录存在
  if (!fs.existsSync(knowledgeRoot)) {
    try {
      fs.mkdirSync(knowledgeRoot, { recursive: true })
    } catch (e) {
      console.error('[FileWatcher] 创建 knowledge 目录失败:', e)
      return { close: () => {}, watchCurrentDir: () => {} }
    }
  }

  const watchers = []
  let currentDirWatcher = null // Linux 动态监听当前浏览目录的 watcher
  const changedDirs = new Set() // 防抖期间聚合的变更目录（已规范化的路径，去重）
  let debounceTimer = null

  /**
   * 触发防抖：聚合 DEBOUNCE_MS 内的所有变更目录，一次性通知渲染进程
   * @param {string} changedDir 发生变更的目录绝对路径
   */
  function scheduleNotify(changedDir) {
    // 统一规范化为 '/' 分隔符，确保前端跨平台比较一致
    changedDirs.add(normalizePath(changedDir))
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
   * 处理 fs.watch 回调的 filename，计算变更发生的实际目录
   * filename 在不同平台可能用 '/' 或 '\\' 作为分隔符，统一用 '/' 处理
   * @param {string} dirPath 被监听的目录绝对路径
   * @param {string|null} filename fs.watch 回调的 filename
   * @returns {string} 变更发生的目录绝对路径
   */
  function resolveChangedDir(dirPath, filename) {
    if (!filename) return dirPath
    // 统一用 '/' 处理（Windows 可能返回 '\\' 或 '/'）
    const normalized = filename.replace(/\\/g, '/')
    if (!normalized.includes('/')) {
      // 直接子项变更，changedDir 就是 dirPath
      return dirPath
    }
    // 含子路径，取父目录
    const parentRel = normalized.split('/').slice(0, -1).join('/')
    if (!parentRel) return dirPath
    const candidate = path.join(dirPath, parentRel)
    if (fs.existsSync(candidate)) {
      return candidate
    }
    return dirPath
  }

  /**
   * 创建单个目录的 watcher
   */
  function watchDir(dirPath, recursive) {
    try {
      const watcher = fs.watch(dirPath, { recursive }, (eventType, filename) => {
        // 忽略隐藏文件/临时文件（. 开头）
        const normalized = filename ? filename.replace(/\\/g, '/') : ''
        if (normalized && normalized.split('/').some(seg => seg.startsWith('.'))) {
          return
        }
        const changedDir = resolveChangedDir(dirPath, filename)
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

  /**
   * 动态监听前端当前浏览目录（Linux 降级方案必需）
   * macOS/Windows 已有 recursive watcher 覆盖，调用此方法为空操作
   * @param {string} dirPath 当前浏览目录绝对路径
   */
  function watchCurrentDir(dirPath) {
    // 关闭之前的当前目录 watcher
    if (currentDirWatcher) {
      try { currentDirWatcher.close() } catch (_e) { /* 忽略 */ }
      currentDirWatcher = null
    }
    if (!dirPath) return
    // macOS/Windows 已有 recursive watcher 覆盖整个 knowledge 目录，无需重复监听
    if (supportsRecursive) return
    // 目标目录不在 knowledge 目录下，不监听（避免越界）
    const normRoot = normalizePath(knowledgeRoot)
    const normTarget = normalizePath(dirPath)
    if (!normTarget.startsWith(normRoot + '/')) return
    if (!fs.existsSync(dirPath)) return

    try {
      currentDirWatcher = fs.watch(dirPath, { recursive: false }, (eventType, filename) => {
        const normalized = filename ? filename.replace(/\\/g, '/') : ''
        if (normalized && normalized.split('/').some(seg => seg.startsWith('.'))) {
          return
        }
        // 当前目录的直接子项变化，changedDir 就是 dirPath
        scheduleNotify(dirPath)
      })
      currentDirWatcher.on('error', err => {
        console.warn('[FileWatcher] currentDirWatcher error:', err?.message || err)
      })
    } catch (e) {
      console.warn(`[FileWatcher] 监听当前目录 ${dirPath} 失败:`, e?.message || e)
    }
  }

  if (supportsRecursive) {
    // 单个递归 watcher 覆盖整个 knowledge 目录
    watchDir(knowledgeRoot, true)
  } else {
    // Linux 降级：静态监听 knowledgeRoot + 各分类一级子目录（捕获知识库列表变化）
    // 当前浏览目录的变化由 watchCurrentDir 动态监听
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
    watchCurrentDir,
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
      if (currentDirWatcher) {
        try { currentDirWatcher.close() } catch (_e) { /* 忽略 */ }
        currentDirWatcher = null
      }
      console.log('[FileWatcher] 已停止 knowledge 目录监听')
    }
  }
}
