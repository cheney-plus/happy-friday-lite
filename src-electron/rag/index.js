import fs from 'fs'
import path from 'path'
import * as db from '../db.js'
import { getDataDir } from '../config.js'
import { loadDocument, getFileType } from './loaders.js'
import { splitDocuments } from './chunkers.js'
import {
  loadFaissStore,
  saveFaissStore,
  addDocuments,
  rebuildStore,
  deleteFaissStore,
  getStoreDocCount,
  KB_TYPES
} from './vectorstore.js'

/**
 * RAG 主流程编排：加载 → 分块 → 向量化 → 存储
 *
 * 单文件处理流程（任务队列调用）：
 *   1. 加载文档（根据文件类型选择加载器）
 *   2. 分块（笔记用结构感知，其他用父子分块）
 *   3. 父块存入 SQLite parent_docs 表
 *   4. 子块向量化后存入 FaissStore
 *
 * 知识库更新流程（用户手动触发）：
 *   1. 扫描知识库目录，比对 file_status 表找出变更文件
 *   2. 采用"内存重建覆盖"策略重建 FaissStore
 *   3. 未变更文件的向量从旧索引加载，变更文件重新生成向量
 *   4. 在内存中构建全新 FaissStore，覆盖写入磁盘
 */

// 根据文件路径推断所属知识库类型
// 文件路径形如: {dataDir}/knowledge/{categoryId}/{kbName}/...
export function inferKbType(filePath) {
  const dataDir = getDataDir()
  const knowledgeDir = path.join(dataDir, 'knowledge')
  const relativePath = path.relative(knowledgeDir, filePath)
  if (relativePath.startsWith('personal')) return 'personal'
  if (relativePath.startsWith('agent')) return 'agent'
  if (relativePath.startsWith('local')) return 'local'
  return null
}

// 获取指定知识库类型的根目录
export function getKbRootPath(kbType) {
  const dataDir = getDataDir()
  return path.join(dataDir, 'knowledge', kbType)
}

// 判断文件是否为可索引的文件类型
function isIndexableFile(fileName) {
  const ext = path.extname(fileName).toLowerCase().slice(1)
  const indexableExts = [
    'txt', 'text', 'log', 'md', 'markdown', 'mdx', 'csv', 'xml',
    'pdf', 'html', 'htm', 'json', 'epub', 'note',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
  ]
  return indexableExts.includes(ext)
}

// 递归扫描目录下所有可索引文件
function scanIndexableFiles(dirPath) {
  const results = []
  if (!fs.existsSync(dirPath)) return results

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
      } else if (isIndexableFile(entry.name)) {
        try {
          const stat = fs.statSync(fullPath)
          results.push({
            filePath: fullPath,
            lastModified: stat.mtime.toISOString(),
            size: stat.size
          })
        } catch (e) {
          // 跳过无法访问的文件
        }
      }
    }
  }

  walk(dirPath)
  return results
}

/**
 * 处理单个文件的索引任务（任务队列的 handler）
 * @param {{kbType: string, filePath: string, lastModified: string}} task
 */
export async function processFileTask(task) {
  const { kbType, filePath, lastModified } = task

  if (!fs.existsSync(filePath)) {
    // 文件已被删除，清理状态和父块
    db.deleteFileStatus(kbType, filePath)
    db.deleteParentDocsBySourcePath(filePath)
    console.log(`[RAG] File deleted, cleaned: ${filePath}`)
    return
  }

  console.log(`[RAG] Processing file: ${filePath}`)

  // 1. 加载文档
  const rawDocs = await loadDocument(filePath, db)

  // 2. 分块
  const fileType = path.extname(filePath).toLowerCase().slice(1)
  const { parentDocs, childDocs } = await splitDocuments(rawDocs, fileType)

  // 3. 删除该文件旧的父块（如果是重新索引）
  db.deleteParentDocsBySourcePath(filePath)

  // 4. 父块存入 SQLite
  if (parentDocs.length > 0) {
    db.insertParentDocsBatch(parentDocs)
  }

  // 5. 子块向量化后存入 FaissStore
  // 注意：单文件增量添加时直接 addDocuments
  // 重建场景由 rebuildKbStore 统一处理
  if (childDocs.length > 0) {
    await addDocuments(kbType, childDocs)
  }

  console.log(`[RAG] File indexed: ${filePath} (parents: ${parentDocs.length}, children: ${childDocs.length})`)
}

/**
 * 重建指定知识库的 FaissStore（内存重建覆盖策略）
 *
 * 流程：
 *   1. 扫描知识库目录，找出所有可索引文件
 *   2. 比对 file_status 表，区分"未变更文件"和"需重新索引文件"
 *   3. 对未变更文件：从旧 FaissStore 中提取其子块向量
 *   4. 对变更文件：重新加载→分块→向量化
 *   5. 在内存中构建全新 FaissStore，覆盖写入磁盘
 *
 * @param {string} kbType - 知识库类型
 * @param {(progress: {current: number, total: number, file: string}) => void} onProgress - 进度回调
 * @returns {Promise<{total: number, changed: number, unchanged: number, failed: number}>}
 */
export async function rebuildKbStore(kbType, onProgress = null) {
  const kbRootPath = getKbRootPath(kbType)
  console.log(`[RAG] Rebuilding kb store: ${kbType} from ${kbRootPath}`)

  // 1. 扫描目录
  const allFiles = scanIndexableFiles(kbRootPath)
  console.log(`[RAG] Found ${allFiles.length} indexable files`)

  // 2. 比对状态库，区分变更/未变更
  const changedFiles = []
  const unchangedFiles = []
  const existingStatusMap = new Map()
  const allStatus = db.getFileStatusByKbType(kbType)
  for (const status of allStatus) {
    existingStatusMap.set(status.file_path, status)
  }

  // 记录当前磁盘上的文件集合，用于后续清理已删除文件的状态
  const currentFilePaths = new Set(allFiles.map(f => f.filePath))

  for (const file of allFiles) {
    const existing = existingStatusMap.get(file.filePath)
    if (!existing || existing.index_status !== 'success' || existing.last_modified !== file.lastModified) {
      changedFiles.push(file)
    } else {
      unchangedFiles.push(file)
    }
  }

  console.log(`[RAG] Changed: ${changedFiles.length}, Unchanged: ${unchangedFiles.length}`)

  // 3. 加载旧 FaissStore，提取未变更文件的子块向量
  let oldStore = null
  let unchangedChildDocs = []
  try {
    oldStore = await loadFaissStore(kbType, true)
    // 从旧索引中提取未变更文件对应的子块
    // FaissStore 的 docstore 存储了所有文档，通过 metadata.source 过滤
    unchangedChildDocs = extractDocsBySources(oldStore, unchangedFiles.map(f => f.filePath))
    console.log(`[RAG] Extracted ${unchangedChildDocs.length} unchanged child docs from old store`)
  } catch (e) {
    console.warn(`[RAG] Failed to load old store, treating all as changed:`, e.message)
    // 旧索引加载失败，所有文件都视为变更
    changedFiles.push(...unchangedFiles)
    unchangedFiles.length = 0
    unchangedChildDocs = []
  }

  // 4. 处理变更文件：重新加载→分块→向量化
  const newChildDocs = []
  const newParentDocs = []
  let failedCount = 0

  // 先删除所有变更文件的旧父块
  for (const file of changedFiles) {
    db.deleteParentDocsBySourcePath(file.filePath)
  }

  const total = changedFiles.length
  for (let i = 0; i < changedFiles.length; i++) {
    const file = changedFiles[i]
    if (onProgress) {
      onProgress({ current: i + 1, total, file: file.filePath })
    }
    try {
      const rawDocs = await loadDocument(file.filePath, db)
      const fileType = path.extname(file.filePath).toLowerCase().slice(1)
      const { parentDocs, childDocs } = await splitDocuments(rawDocs, fileType)
      newParentDocs.push(...parentDocs)
      newChildDocs.push(...childDocs)
      // 更新状态为 success
      db.upsertFileStatus(kbType, file.filePath, file.lastModified, 'success')
    } catch (e) {
      console.error(`[RAG] Failed to index ${file.filePath}:`, e.message)
      db.upsertFileStatus(kbType, file.filePath, file.lastModified, 'failed')
      failedCount++
    }
  }

  // 5. 批量插入新父块
  if (newParentDocs.length > 0) {
    db.insertParentDocsBatch(newParentDocs)
  }

  // 6. 合并所有子块（未变更 + 新生成），构建全新 FaissStore
  const allChildDocs = [...unchangedChildDocs, ...newChildDocs]
  await rebuildStore(kbType, allChildDocs)

  // 7. 清理已删除文件的状态记录和父块
  for (const [filePath, status] of existingStatusMap.entries()) {
    if (!currentFilePaths.has(filePath)) {
      db.deleteFileStatus(kbType, filePath)
      db.deleteParentDocsBySourcePath(filePath)
    }
  }

  const result = {
    total: allFiles.length,
    changed: changedFiles.length,
    unchanged: unchangedFiles.length,
    failed: failedCount
  }
  console.log(`[RAG] Rebuild complete:`, result)
  return result
}

/**
 * 从 FaissStore 中提取指定来源文件的子块文档
 * @param {FaissStore} store
 * @param {string[]} sourcePaths
 * @returns {Array} Document 数组
 */
function extractDocsBySources(store, sourcePaths) {
  if (!sourcePaths.length || !store.docstore) return []
  const sourceSet = new Set(sourcePaths)
  const result = []

  // FaissStore 内部 docstore._docs 是 Map<string, Document>
  const docsMap = store.docstore._docs
  if (docsMap && docsMap instanceof Map) {
    for (const [id, doc] of docsMap) {
      if (doc && doc.metadata && sourceSet.has(doc.metadata.source)) {
        result.push(doc)
      }
    }
  } else if (docsMap && typeof docsMap === 'object') {
    // 兼容普通对象
    for (const [id, doc] of Object.entries(docsMap)) {
      if (doc && doc.metadata && sourceSet.has(doc.metadata.source)) {
        result.push(doc)
      }
    }
  }
  return result
}

/**
 * 获取指定知识库的索引状态摘要
 * @param {string} kbType
 */
export async function getKbIndexSummary(kbType) {
  const stats = db.getFileStatusByKbType(kbType)
  const summary = {
    total: stats.length,
    success: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    vectorCount: await getStoreDocCount(kbType)
  }
  for (const s of stats) {
    if (summary.hasOwnProperty(s.index_status)) {
      summary[s.index_status]++
    }
  }
  return summary
}

/**
 * 获取单个文件的索引状态
 * @param {string} filePath
 */
export function getFileIndexStatus(filePath) {
  const kbType = inferKbType(filePath)
  if (!kbType) return null
  return db.getFileStatus(kbType, filePath)
}

/**
 * 批量获取文件的索引状态
 * @param {string[]} filePaths
 * @returns {Object} filePath -> status 映射
 */
export function getBatchFileIndexStatus(filePaths) {
  const result = {}
  for (const filePath of filePaths) {
    const status = getFileIndexStatus(filePath)
    result[filePath] = status ? status.index_status : null
  }
  return result
}

/**
 * 清空指定知识库的所有索引数据
 * @param {string} kbType
 */
export async function clearKbIndex(kbType) {
  await deleteFaissStore(kbType)
  db.deleteFileStatusByKbType(kbType)
  const kbRootPath = getKbRootPath(kbType)
  db.deleteParentDocsByKbType(kbType, kbRootPath)
  console.log(`[RAG] Cleared all index data for kb: ${kbType}`)
}
