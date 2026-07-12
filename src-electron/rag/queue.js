import * as db from '../db.js'
import { deleteBySource } from './vectorstore.js'

/**
 * 基于 SQLite file_status 表的串行任务队列
 *
 * 设计要点：
 * - 使用 file_status 表的 index_status 字段标记任务状态：pending / processing / success / failed
 * - 文件路径 (kb_type + file_path) 作为去重 Key，同一文件同时只有一个任务
 * - 串行处理：每次只取一个 pending 任务，处理完成后再取下一个
 * - 仅在入队时立即触发处理（无定时轮询，向量化完全由用户手动触发）
 * - 支持取消当前任务（用户点击"停止"时），取消后清理已插入的向量
 */

// 任务处理器函数类型：(task, options) => Promise<void>
let taskHandler = null
let onTaskComplete = null
let onProgressCb = null
let processing = false

// 取消标志：用户点击"停止"时置为 true，任务处理器检测后提前退出
let cancelRequested = false

/**
 * 注册任务处理器
 * @param {(task: {kbType: string, filePath: string, lastModified: string}, options: {onProgress: Function, isCancelled: Function}) => Promise<void>} handler
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
 * 注册进度回调（用于向前端发送实时进度）
 * @param {(data: object) => void} callback
 */
export function setOnProgress(callback) {
  onProgressCb = callback
}

/**
 * 取消当前正在处理的任务
 * 设置 cancelRequested 标志，任务处理器会在下一个检查点退出
 */
export function cancelCurrentTask() {
  if (processing) {
    cancelRequested = true
    console.log('[RAG Queue] Cancel requested by user')
  }
}

/**
 * 将文件入队（如果已存在且状态为 pending/processing 则忽略，避免重复入队）
 * @param {string} kbType - 知识库类型: personal / local（工作区 agent 不入队）
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
  cancelRequested = false
  // 标记为 processing
  db.updateFileStatus(task.kbType, task.filePath, 'processing')
  console.log(`[RAG Queue] Task started: ${task.filePath}`)

  // 通知前端开始处理
  if (onProgressCb) {
    onProgressCb({ phase: 'start', file: task.filePath, kbType: task.kbType })
  }

  try {
    await taskHandler(task, {
      onProgress: (data) => {
        if (onProgressCb) {
          onProgressCb({ ...data, file: task.filePath, kbType: task.kbType })
        }
      },
      isCancelled: () => cancelRequested
    })

    if (cancelRequested) {
      // 用户取消：清理已插入的向量、父块和状态记录
      console.log(`[RAG Queue] Task cancelled, cleaning up: ${task.filePath}`)
      db.deleteFileStatus(task.kbType, task.filePath)
      db.deleteParentDocsBySourcePath(task.filePath)
      await deleteBySource(task.filePath)
      console.log(`[RAG Queue] Cleanup done for cancelled task: ${task.filePath}`)
      if (onTaskComplete) onTaskComplete(task, 'cancelled')
    } else {
      db.updateFileStatus(task.kbType, task.filePath, 'success')
      console.log(`[RAG Queue] Task success: ${task.filePath}`)
      if (onTaskComplete) onTaskComplete(task, 'success')
    }
  } catch (e) {
    console.error(`[RAG Queue] Task failed: ${task.filePath}`, e)
    db.updateFileStatus(task.kbType, task.filePath, 'failed')
    if (onTaskComplete) onTaskComplete(task, 'failed')
  } finally {
    processing = false
    cancelRequested = false
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
