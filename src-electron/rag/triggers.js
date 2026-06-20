import fs from 'fs'
import path from 'path'
import * as db from '../db.js'
import { loadConfig, saveConfig, getDataDir } from '../config.js'
import { enqueue, enqueueBatch, startQueue, setTaskHandler, setOnTaskComplete } from './queue.js'
import { processFileTask, inferKbType, getKbRootPath, rebuildKbStore } from './index.js'
import { KB_TYPES } from './vectorstore.js'

/**
 * RAG 触发时机实现
 *
 * 三个触发时机：
 *   1. 用户上传/导入文件时：将文件推入队列
 *   2. 每日应用启动时：扫描变更文件入队
 *   3. 用户点击"知识库检索更新"按钮：仅对修改日期不一致的文件重建索引
 *
 * 并发控制：通过任务队列的串行处理 + 文件路径去重保证
 */

let initialized = false

/**
 * 初始化 RAG 模块（应用启动时调用一次）
 * - 注册任务处理器
 * - 启动队列轮询
 * - 根据配置决定是否执行启动时自动更新
 * @param {(channel: string, data: any) => void} sendToRenderer - 向渲染进程发送事件的函数
 */
export async function initRag(sendToRenderer = null) {
  if (initialized) return
  initialized = true

  // 注册任务处理器
  setTaskHandler(processFileTask)

  // 注册任务完成回调，通知前端刷新文件索引状态
  if (sendToRenderer) {
    setOnTaskComplete((task, status) => {
      sendToRenderer('rag-task-complete', { filePath: task.filePath, kbType: task.kbType, status })
    })
  }

  // 启动队列轮询（5 分钟一次 + 入队立即触发）
  startQueue()

  console.log('[RAG] Initialized')

  // 根据配置决定是否启动时自动更新
  const config = loadConfig()
  if (config.rag && config.rag.autoUpdateOnStartup) {
    // 异步执行，不阻塞应用启动
    triggerStartupUpdate().catch(e => {
      console.error('[RAG] Startup update failed:', e)
    })
  }
}

/**
 * 触发时机 1：用户上传/导入文件时
 * 将文件推入队列，等待异步处理
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否成功入队
 */
export function triggerOnFileUpload(filePath) {
  const kbType = inferKbType(filePath)
  if (!kbType) {
    console.warn(`[RAG] Cannot infer kbType for: ${filePath}`)
    return false
  }

  if (!fs.existsSync(filePath)) {
    console.warn(`[RAG] File not exists: ${filePath}`)
    return false
  }

  const stat = fs.statSync(filePath)
  const lastModified = stat.mtime.toISOString()
  return enqueue(kbType, filePath, lastModified)
}

/**
 * 批量触发：上传文件夹或多个文件时
 * @param {string[]} filePaths
 * @returns {number} 实际入队数量
 */
export function triggerOnFilesUpload(filePaths) {
  const tasks = []
  for (const filePath of filePaths) {
    const kbType = inferKbType(filePath)
    if (!kbType) continue
    if (!fs.existsSync(filePath)) continue
    try {
      const stat = fs.statSync(filePath)
      tasks.push({
        kbType,
        filePath,
        lastModified: stat.mtime.toISOString()
      })
    } catch (e) {
      // 跳过无法访问的文件
    }
  }
  return enqueueBatch(tasks)
}

/**
 * 触发时机 2：每日应用启动时
 * 对于已经发生修改或者新增的文件，将文件推入队列
 * 通过 lastAutoUpdateAt 判断是否今天已执行过
 */
export async function triggerStartupUpdate() {
  const config = loadConfig()
  const lastUpdateAt = config.rag?.lastAutoUpdateAt

  // 判断今天是否已经执行过
  const today = new Date().toDateString()
  if (lastUpdateAt) {
    const lastDate = new Date(lastUpdateAt).toDateString()
    if (lastDate === today) {
      console.log('[RAG] Already updated today, skip startup update')
      return
    }
  }

  console.log('[RAG] Running startup update...')
  let totalEnqueued = 0

  for (const kbType of KB_TYPES) {
    const kbRootPath = getKbRootPath(kbType)
    if (!fs.existsSync(kbRootPath)) continue

    const changedFiles = findChangedFiles(kbType, kbRootPath)
    if (changedFiles.length > 0) {
      totalEnqueued += enqueueBatch(changedFiles)
    }
  }

  // 更新最后执行时间
  config.rag = { ...config.rag, lastAutoUpdateAt: new Date().toISOString() }
  saveConfig(config)

  console.log(`[RAG] Startup update done, enqueued ${totalEnqueued} files`)
}

/**
 * 扫描指定知识库目录，找出新增或修改的文件
 * @param {string} kbType
 * @param {string} kbRootPath
 * @returns {Array<{kbType: string, filePath: string, lastModified: string}>}
 */
function findChangedFiles(kbType, kbRootPath) {
  const indexableExts = [
    'txt', 'text', 'log', 'md', 'markdown', 'mdx', 'csv', 'xml',
    'pdf', 'html', 'htm', 'json', 'epub', 'note',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
  ]
  const changed = []

  function walk(currentPath) {
    let entries
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true })
    } catch (e) {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase().slice(1)
        if (!indexableExts.includes(ext)) continue
        try {
          const stat = fs.statSync(fullPath)
          const lastModified = stat.mtime.toISOString()
          const existing = db.getFileStatus(kbType, fullPath)
          // 新文件 或 已索引但修改时间不一致
          if (!existing || (existing.index_status === 'success' && existing.last_modified !== lastModified)) {
            changed.push({ kbType, filePath: fullPath, lastModified })
          }
        } catch (e) {
          // 跳过
        }
      }
    }
  }

  walk(kbRootPath)
  return changed
}

/**
 * 触发时机 3：用户点击"知识库检索更新"按钮
 * 仅对修改日期不一致的文件进行重建索引
 *
 * 采用"内存重建覆盖"策略：
 *   - 比对状态库找出变更文件
 *   - 未变更文件向量从旧索引加载
 *   - 变更文件重新生成向量
 *   - 内存中构建全新 FaissStore，覆盖写入磁盘
 *
 * @param {string} kbType - 指定知识库类型，不传则更新所有
 * @param {(progress: {current: number, total: number, file: string, kbType: string}) => void} onProgress
 * @returns {Promise<Object>} 重建结果统计
 */
export async function triggerManualUpdate(kbType = null, onProgress = null) {
  const targetTypes = kbType ? [kbType] : KB_TYPES
  const results = {}

  for (const type of targetTypes) {
    const kbRootPath = getKbRootPath(type)
    if (!fs.existsSync(kbRootPath)) {
      results[type] = { total: 0, changed: 0, unchanged: 0, failed: 0 }
      continue
    }

    console.log(`[RAG] Manual update for kb: ${type}`)
    const result = await rebuildKbStore(type, (progress) => {
      if (onProgress) {
        onProgress({ ...progress, kbType: type })
      }
    })
    results[type] = result
  }

  return results
}
