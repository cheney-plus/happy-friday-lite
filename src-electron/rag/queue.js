import * as db from '../db.js'

/**
 * 基于 SQLite file_status 表的串行任务队列
 *
 * 设计要点：
 * - 使用 file_status 表的 index_status 字段标记任务状态：pending / processing / success / failed
 * - 文件路径 (kb_type + file_path) 作为去重 Key，同一文件同时只有一个任务
 * - 串行处理：每次只取一个 pending 任务，处理完成后再取下一个
 * - 5 分钟轮询检查 + 入队时立即触发一次检查
 */

// 任务处理器函数类型：(task) => Promise<void>
let taskHandler = null
let onTaskComplete = null
let processing = false
let pollTimer = null
const POLL_INTERVAL = 5 * 60 * 1000 // 5 分钟

/**
 * 注册任务处理器
 * @param {(task: {kbType: string, filePath: string, lastModified: string}) => Promise<void>} handler
 */
export function setTaskHandler(handler) {
  taskHandler = handler
}

/**
 * 注册任务完成回调（用于通知前端刷新状态）
 * @param {(task: {kbType: string, filePath: string, lastModified: string}, status: string) => void} callback
 */
export function setOnTaskComplete(callback) {
  onTaskComplete = callback
}

/**
 * 将文件入队（如果已存在且状态为 pending/processing 则忽略，避免重复入队）
 * @param {string} kbType - 知识库类型: personal / agent / local
 * @param {string} filePath - 文件路径
 * @param {string} lastModified - 文件最后修改时间 ISO 字符串
 * @param {boolean} forceReindex - 是否强制重新索引（即使状态为 success 也重置为 pending）
 * @returns {boolean} 是否真正入队（false 表示已存在且未变更）
 */
export function enqueue(kbType, filePath, lastModified, forceReindex = false) {
  const existing = db.getFileStatus(kbType, filePath)

  if (existing) {
    // 已存在记录
    if (existing.index_status === 'processing') {
      // 正在处理中，忽略
      return false
    }
    if (!forceReindex && existing.index_status === 'success' && existing.last_modified === lastModified) {
      // 已成功索引且未变更，忽略
      return false
    }
    // 需要重新索引：更新状态为 pending
    db.upsertFileStatus(kbType, filePath, lastModified, 'pending')
  } else {
    // 新文件，插入 pending 状态
    db.upsertFileStatus(kbType, filePath, lastModified, 'pending')
  }

  // 入队后立即触发一次检查
  scheduleImmediateProcess()
  return true
}

/**
 * 批量入队
 * @param {Array<{kbType: string, filePath: string, lastModified: string}>} tasks
 * @param {boolean} forceReindex
 * @returns {number} 实际入队的任务数
 */
export function enqueueBatch(tasks, forceReindex = false) {
  let count = 0
  for (const task of tasks) {
    if (enqueue(task.kbType, task.filePath, task.lastModified, forceReindex)) {
      count++
    }
  }
  return count
}

/**
 * 获取下一个待处理任务
 * @returns {{kbType: string, filePath: string, lastModified: string} | null}
 */
function getNextTask() {
  const rows = db.queryAllRaw(
    "SELECT kb_type, file_path, last_modified FROM file_status WHERE index_status = 'pending' ORDER BY id ASC LIMIT 1"
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    kbType: row.kb_type,
    filePath: row.file_path,
    lastModified: row.last_modified
  }
}

/**
 * 处理单个任务
 */
async function processOne() {
  if (processing) return
  if (!taskHandler) {
    console.warn('[RAG Queue] No task handler registered')
    return
  }

  const task = getNextTask()
  if (!task) return

  processing = true
  // 标记为 processing
  db.updateFileStatus(task.kbType, task.filePath, 'processing')

  try {
    await taskHandler(task)
    db.updateFileStatus(task.kbType, task.filePath, 'success')
    console.log(`[RAG Queue] Task success: ${task.filePath}`)
    if (onTaskComplete) onTaskComplete(task, 'success')
  } catch (e) {
    console.error(`[RAG Queue] Task failed: ${task.filePath}`, e)
    db.updateFileStatus(task.kbType, task.filePath, 'failed')
    if (onTaskComplete) onTaskComplete(task, 'failed')
  } finally {
    processing = false
    // 处理完一个任务后，立即尝试处理下一个（串行）
    setImmediate(processNext)
  }
}

/**
 * 处理下一个任务（带防重入）
 */
async function processNext() {
  if (processing) return
  await processOne()
}

/**
 * 立即触发一次任务检查（防抖：避免频繁触发）
 */
let immediateTimer = null
function scheduleImmediateProcess() {
  if (immediateTimer) return
  immediateTimer = setTimeout(() => {
    immediateTimer = null
    processNext().catch(e => console.error('[RAG Queue] Immediate process error:', e))
  }, 100)
}

/**
 * 启动队列轮询
 * 每隔 5 分钟检查一次是否有新的任务需要处理
 */
export function startQueue() {
  stopQueue()
  // 立即处理一次（应用启动时）
  scheduleImmediateProcess()
  // 定时轮询
  pollTimer = setInterval(() => {
    processNext().catch(e => console.error('[RAG Queue] Poll process error:', e))
  }, POLL_INTERVAL)
  console.log(`[RAG Queue] Started, polling every ${POLL_INTERVAL / 1000}s`)
}

/**
 * 停止队列轮询
 */
export function stopQueue() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (immediateTimer) {
    clearTimeout(immediateTimer)
    immediateTimer = null
  }
}

/**
 * 获取队列状态统计
 * @param {string} kbType - 可选，指定知识库类型
 * @returns {{pending: number, processing: number, success: number, failed: number}}
 */
export function getQueueStats(kbType = null) {
  const condition = kbType ? `WHERE kb_type = '${kbType.replace(/'/g, "''")}'` : ''
  const rows = db.queryAllRaw(
    `SELECT index_status, COUNT(*) as count FROM file_status ${condition} GROUP BY index_status`
  )
  const stats = { pending: 0, processing: 0, success: 0, failed: 0 }
  for (const row of rows) {
    if (stats.hasOwnProperty(row.index_status)) {
      stats[row.index_status] = row.count
    }
  }
  return stats
}

/**
 * 重置失败任务为 pending（用于重试）
 * @param {string} kbType - 可选
 */
export function retryFailed(kbType = null) {
  if (kbType) {
    db.queryAllRaw(
      `UPDATE file_status SET index_status = 'pending' WHERE index_status = 'failed' AND kb_type = ?`,
      [kbType]
    )
  } else {
    db.queryAllRaw(
      `UPDATE file_status SET index_status = 'pending' WHERE index_status = 'failed'`
    )
  }
  scheduleImmediateProcess()
}
