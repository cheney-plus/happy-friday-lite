import fs from 'fs'
import { enqueue, setTaskHandler, setOnTaskComplete, setOnProgress, cancelCurrentTask } from './queue.js'
import { processFileTask, inferKbType, getKbRootPath, rebuildKbStore } from './index.js'
import { KB_TYPES } from './vectorstore.js'

/**
 * RAG 触发时机实现
 *
 * 向量化完全由用户手动触发（无定时轮询、无启动时自动更新）：
 *   1. 用户右键文件 → "构建索引"：将单个文件推入队列异步处理
 *   2. 用户在设置页点击"更新索引"：批量重建（增量删除+重插）
 *
 * 并发控制：通过任务队列的串行处理 + 文件路径去重保证
 * 进度上报：通过 onProgress 回调向前端发送 rag-build-progress 事件
 * 取消机制：用户点击"停止"时调用 stopBuildIndex()，队列检测后退出并清理
 */

let initialized = false

/**
 * 初始化 RAG 模块（应用启动时调用一次）
 * - 注册任务处理器
 * - 注册进度回调（通知前端实时进度）
 * - 注册任务完成回调（通知前端刷新文件卡片状态）
 * @param {(channel: string, data: any) => void} sendToRenderer - 向渲染进程发送事件的函数
 */
export async function initRag(sendToRenderer = null) {
  if (initialized) return
  initialized = true

  // 注册任务处理器
  setTaskHandler(processFileTask)

  if (sendToRenderer) {
    // 注册进度回调，通知前端实时进度
    setOnProgress((data) => {
      sendToRenderer('rag-build-progress', data)
    })

    // 注册任务完成回调，通知前端刷新文件索引状态
    setOnTaskComplete((task, status) => {
      sendToRenderer('rag-task-complete', { filePath: task.filePath, kbType: task.kbType, status })
    })
  }

  console.log('[RAG] Initialized (manual mode, no scheduled polling)')
}

/**
 * 手动触发单个文件的索引（右键"构建索引"）
 * 强制重新索引，即使已索引过也会重新构建
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
  console.log(`[RAG] Enqueuing build-index task: ${filePath} (kb=${kbType})`)
  // forceReindex=true：用户主动构建索引，即使已索引也重新构建
  return enqueue(kbType, filePath, lastModified, true)
}

/**
 * 停止当前正在进行的索引任务
 * 设置取消标志，任务处理器在下一个检查点退出并清理已插入的向量
 */
export function stopBuildIndex() {
  console.log('[RAG] stopBuildIndex called by user')
  cancelCurrentTask()
}

/**
 * 用户点击"更新索引"按钮：批量重建
 *
 * 采用"增量删除+重插"策略：
 *   - 清理已删除文件的向量
 *   - 重新索引未索引/已变更/已失败的文件
 *   - 批量处理后优化 HNSW 索引
 *
 * @param {string} kbType - 指定知识库类型，不传则更新所有
 * @param {(progress: object) => void} onProgress
 * @returns {Promise<Object>} 重建结果统计
 */
export async function triggerManualUpdate(kbType = null, onProgress = null) {
  const targetTypes = kbType ? [kbType] : KB_TYPES
  const results = {}

  for (let typeIndex = 0; typeIndex < targetTypes.length; typeIndex++) {
    const type = targetTypes[typeIndex]
    const kbRootPath = getKbRootPath(type)
    if (!fs.existsSync(kbRootPath)) {
      results[type] = { total: 0, changed: 0, unchanged: 0, failed: 0 }
      continue
    }

    console.log(`[RAG] Manual update for kb: ${type} (${typeIndex + 1}/${targetTypes.length})`)
    const result = await rebuildKbStore(type, (progress) => {
      if (onProgress) {
        onProgress({ ...progress, kbType: type, kbIndex: typeIndex + 1, kbCount: targetTypes.length })
      }
    })
    results[type] = result
  }

  return results
}
