import fs from 'fs'
import path from 'path'
import * as db from '../db.js'
import { getDataDir } from '../config.js'
import { loadDocument } from './loaders.js'
import { splitDocuments } from './chunkers.js'
import {
  addDocuments,
  deleteStore,
  deleteBySource,
  optimizeCollection,
  searchByQuery,
  KB_TYPES
} from './vectorstore.js'

/**
 * RAG 主流程编排：加载 → 分块 → 向量化 → 存储
 *
 * 单文件处理流程（任务队列调用）：
 *   1. 加载文档（根据文件类型选择加载器）
 *   2. 分块（笔记用结构感知，其他用父子分块）
 *   3. 父块存入 SQLite parent_docs 表
 *   4. 子块向量化后存入 Zvec collection
 *
 * 知识库更新流程（用户手动触发）：
 *   采用"增量删除+重插"策略：
 *   1. 扫描知识库目录，比对 file_status 表找出变更/删除文件
 *   2. 变更文件：addDocuments 内部先按 source 删除旧向量再插入新向量
 *   3. 删除文件：按 source 删除对应向量
 *   4. 批量处理后调用 optimizeCollection 优化 HNSW 索引
 *   未变更文件的向量原位保留在共享 collection 中，无需迁移。
 */

// 根据文件路径推断所属知识库类型
// 文件路径形如: {dataDir}/knowledge/{categoryId}/{kbName}/...
// 工作区(agent)不参与向量化与检索，返回 null 跳过处理
export function inferKbType(filePath) {
  const dataDir = getDataDir()
  const knowledgeDir = path.join(dataDir, 'knowledge')
  const relativePath = path.relative(knowledgeDir, filePath)
  if (relativePath.startsWith('personal')) return 'personal'
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
    // 文件已被删除，清理状态、父块和向量
    db.deleteFileStatus(kbType, filePath)
    db.deleteParentDocsBySourcePath(filePath)
    await deleteBySource(filePath)
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

  // 5. 子块向量化后存入 Zvec collection
  // addDocuments 内部会先按 source 删除旧向量，再 embedding 并插入新向量
  const insertedCount = childDocs.length > 0
    ? await addDocuments(kbType, childDocs)
    : 0

  // 6. 记录子块数量，用于 getVectorCount 统计
  db.setFileChunkCount(kbType, filePath, insertedCount)

  console.log(`[RAG] File indexed: ${filePath} (parents: ${parentDocs.length}, children: ${childDocs.length}, inserted: ${insertedCount})`)
}

/**
 * 重建指定知识库的向量索引（增量删除+重插策略）
 *
 * 流程：
 *   1. 扫描知识库目录，找出所有可索引文件
 *   2. 比对 file_status 表，区分"未变更文件"、"变更文件"和"已删除文件"
 *   3. 变更文件：重新加载→分块→addDocuments（内部按 source 删旧插新）+ 更新 chunk_count
 *   4. 已删除文件：按 source 删除向量 + 清理 file_status 和 parent_docs
 *   5. 批量处理后调用 optimizeCollection 优化 HNSW 索引
 *   未变更文件的向量原位保留在共享 collection 中，无需迁移。
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

  // 2. 比对状态库，区分变更/未变更/已删除
  const changedFiles = []
  const existingStatusMap = new Map()
  const allStatus = db.getFileStatusByKbType(kbType)
  for (const status of allStatus) {
    existingStatusMap.set(status.file_path, status)
  }

  // 记录当前磁盘上的文件集合，用于识别已删除文件
  const currentFilePaths = new Set(allFiles.map(f => f.filePath))

  for (const file of allFiles) {
    const existing = existingStatusMap.get(file.filePath)
    if (!existing || existing.index_status !== 'success' || existing.last_modified !== file.lastModified) {
      changedFiles.push(file)
    }
  }

  // 已删除文件：在 file_status 中存在，但磁盘上已不存在
  const deletedFiles = []
  for (const [filePath] of existingStatusMap.entries()) {
    if (!currentFilePaths.has(filePath)) {
      deletedFiles.push(filePath)
    }
  }

  console.log(`[RAG] Changed: ${changedFiles.length}, Deleted: ${deletedFiles.length}`)

  // 3. 处理已删除文件：清理向量、状态和父块
  for (const filePath of deletedFiles) {
    db.deleteFileStatus(kbType, filePath)
    db.deleteParentDocsBySourcePath(filePath)
    await deleteBySource(filePath)
  }

  // 4. 处理变更文件：重新加载→分块→addDocuments
  let failedCount = 0
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

      // 删除旧父块后插入新父块
      db.deleteParentDocsBySourcePath(file.filePath)
      if (parentDocs.length > 0) {
        db.insertParentDocsBatch(parentDocs)
      }

      // 向量化（addDocuments 内部按 source 删旧插新）
      const insertedCount = childDocs.length > 0
        ? await addDocuments(kbType, childDocs)
        : 0

      // 更新状态和子块数量
      db.upsertFileStatus(kbType, file.filePath, file.lastModified, 'success')
      db.setFileChunkCount(kbType, file.filePath, insertedCount)
    } catch (e) {
      console.error(`[RAG] Failed to index ${file.filePath}:`, e.message)
      db.upsertFileStatus(kbType, file.filePath, file.lastModified, 'failed')
      failedCount++
    }
  }

  // 5. 批量插入后优化 HNSW 索引，提升后续检索性能
  if (changedFiles.length > 0 || deletedFiles.length > 0) {
    await optimizeCollection()
  }

  const result = {
    total: allFiles.length,
    changed: changedFiles.length,
    unchanged: allFiles.length - changedFiles.length,
    failed: failedCount
  }
  console.log(`[RAG] Rebuild complete:`, result)
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
    vectorCount: db.getVectorCount(kbType)
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
  // 删除该 kbType 在 Zvec collection 中的全部向量
  await deleteStore(kbType)
  db.deleteFileStatusByKbType(kbType)
  const kbRootPath = getKbRootPath(kbType)
  db.deleteParentDocsByKbType(kbType, kbRootPath)
  console.log(`[RAG] Cleared all index data for kb: ${kbType}`)
}

/**
 * 将 Zvec 返回的分数转换为置信度
 *
 * Zvec 使用 COSINE 度量，query 返回的 score 为余弦【距离】：
 *   - distance = 1 - cosine_similarity
 *   - 范围 [0, 2]，越小越相似（0 表示完全相同）
 *   - 转换为相似度/置信度：confidence = 1 - distance，范围 [-1, 1]
 *   - 文本嵌入通常落在 [0, 1] 区间
 *
 * @param {number} score - Zvec COSINE 返回的距离（越小越相似）
 * @returns {number} 置信度 [0, 1]
 */
function distanceToConfidence(score) {
  // 距离转相似度，截断到 [0, 1] 范围
  return Math.max(0, Math.min(1, 1 - score))
}

/**
 * RAG 知识检索
 *
 * 流程：
 *   1. 根据用户选择的知识库确定检索范围（全部 / 某个分类下的具体知识库）
 *   2. 在 Zvec collection 中按 kb_type 过滤执行向量检索
 *   3. 将余弦距离转换为置信度，过滤低于阈值的结果
 *   4. 按置信度降序取 TOP K
 *   5. 若选择了具体知识库，按目录路径过滤结果
 *   6. 对每个命中的子块，查 parent_docs 表取回父块文本（Small-to-Big）
 *      若无父块则使用子块自身文本
 *
 * @param {string} query - 用户查询文本
 * @param {string} kbName - 知识库名称（"全部知识库" 或具体名称）
 * @param {string} kbCategoryId - 知识库所属分类 ID（personal/local，工作区 agent 不参与检索）
 * @param {number} topK - 返回结果数上限，默认 10
 * @param {number} scoreThreshold - 置信度阈值，默认 0.5
 * @param {string} [folderPath] - 可选的文件夹路径过滤（用于基于文件夹提问时进一步过滤）
 * @returns {Promise<Array<{content, source, confidence, kbType, metadata, parentInfo}>>}
 */
export async function searchKnowledgeBase(query, kbName, kbCategoryId, topK = 10, scoreThreshold = 0.5, folderPath = '') {
  console.log(`[RAG] ====== 检索开始 ======`)
  console.log(`[RAG] 查询: "${query}"`)
  console.log(`[RAG] 知识库: "${kbName || '全部知识库'}", 分类: "${kbCategoryId || '无'}", topK=${topK}, 阈值=${scoreThreshold}, folderPath="${folderPath || '无'}"`)

  // 1. 确定检索的知识库范围和路径过滤条件
  let kbTypesToSearch = []
  let kbPathFilter = null

  if (!kbName || kbName === '全部知识库') {
    // 全部知识库：检索 personal + local，不做路径过滤
    kbTypesToSearch = [...KB_TYPES]
  } else if (kbCategoryId && KB_TYPES.includes(kbCategoryId)) {
    // 具体知识库：只检索对应分类
    kbTypesToSearch = [kbCategoryId]
    const dataDir = getDataDir()
    kbPathFilter = path.join(dataDir, 'knowledge', kbCategoryId, kbName)
  } else {
    // 已指定知识库名但未提供有效分类，无法定位，返回空结果
    console.warn(`[RAG] 已指定知识库 "${kbName}" 但分类 "${kbCategoryId}" 无效，跳过检索`)
    return []
  }

  // 基于文件夹提问时，使用文件夹路径作为过滤条件（覆盖知识库路径过滤）
  if (folderPath) {
    kbPathFilter = folderPath
  }

  console.log(`[RAG] 检索范围: ${kbTypesToSearch.join(', ')}, 路径过滤: ${kbPathFilter || '无'}`)

  // 2. 在 Zvec collection 中检索（单次调用，按 kb_type 过滤）
  // 多取一些结果以便后续过滤后仍有足够数量
  const searchK = Math.max(topK * 3, 10)
  let rawResults = []
  try {
    rawResults = await searchByQuery(query, kbTypesToSearch, searchK)
    console.log(`[RAG] Zvec 原始检索返回 ${rawResults.length} 条结果`)
  } catch (e) {
    console.warn(`[RAG] searchByQuery failed:`, e.message)
    return []
  }

  // 3. 距离转置信度，过滤低于阈值的结果
  const allResults = []
  for (const r of rawResults) {
    const confidence = distanceToConfidence(r.score)
    const source = (r.doc.metadata && r.doc.metadata.source) || ''
    console.log(`[RAG]   - distance=${r.score.toFixed(4)}, confidence=${confidence.toFixed(4)}, source=${source}`)
    if (confidence >= scoreThreshold) {
      allResults.push({
        doc: r.doc,
        confidence,
        score: r.score,
        kbType: r.kbType
      })
    }
  }
  console.log(`[RAG] 通过阈值过滤后剩余 ${allResults.length} 条`)

  // 4. 按置信度降序排序
  allResults.sort((a, b) => b.confidence - a.confidence)

  // 5. 取 TOP K
  const topResults = allResults.slice(0, topK)
  console.log(`[RAG] TOP ${topK} 结果（按置信度降序）:`)
  topResults.forEach((r, i) => {
    console.log(`[RAG]   ${i + 1}. confidence=${r.confidence.toFixed(4)}, kbType=${r.kbType}, source=${(r.doc.metadata && r.doc.metadata.source) || ''}`)
  })

  // 6. 若选择了具体知识库，按目录路径过滤结果
  let filteredResults = topResults
  if (kbPathFilter) {
    const filterPrefix = kbPathFilter + path.sep
    filteredResults = topResults.filter(r => {
      const source = (r.doc.metadata && r.doc.metadata.source) || ''
      return source.startsWith(filterPrefix)
    })
    console.log(`[RAG] 知识库路径过滤后剩余 ${filteredResults.length} 条 (过滤前缀: ${filterPrefix})`)
  }

  // 7. 对每个命中的子块，查父块表取回父块文本（Small-to-Big）
  const finalResults = []
  for (const result of filteredResults) {
    const docId = result.doc.metadata && result.doc.metadata.docId
    let content = result.doc.pageContent
    let parentInfo = null

    if (docId) {
      const parentDoc = db.getParentDoc(docId)
      if (parentDoc && parentDoc.content) {
        // 有父块则使用父块的完整大段文本
        content = parentDoc.content
        parentInfo = {
          uuid: parentDoc.uuid,
          docId: parentDoc.doc_id,
          sourcePath: parentDoc.source_path,
          fileType: parentDoc.file_type
        }
        console.log(`[RAG]   ✓ 命中父块: uuid=${parentDoc.uuid}, source=${parentDoc.source_path}, 内容长度=${content.length}`)
      } else {
        console.log(`[RAG]   - 无父块，使用子块自身文本 (docId=${docId}), 内容长度=${content.length}`)
      }
    }

    finalResults.push({
      content,
      source: (result.doc.metadata && result.doc.metadata.source) || '',
      confidence: result.confidence,
      kbType: result.kbType,
      metadata: {
        fileType: result.doc.metadata && result.doc.metadata.fileType,
        title: result.doc.metadata && result.doc.metadata.title,
        noteId: result.doc.metadata && result.doc.metadata.noteId
      },
      parentInfo
    })
  }

  // 8. 父块去重：多个子块可能映射到同一个父块，避免重复内容
  const dedupedResults = []
  const seenParentUuids = new Set()
  const seenContents = new Set()
  for (const result of finalResults) {
    const parentUuid = result.parentInfo && result.parentInfo.uuid
    if (parentUuid) {
      if (seenParentUuids.has(parentUuid)) {
        console.log(`[RAG]   ✗ 去重: 父块 uuid=${parentUuid} 已存在，跳过`)
        continue
      }
      seenParentUuids.add(parentUuid)
    } else {
      // 无父块时按内容去重
      if (seenContents.has(result.content)) {
        console.log(`[RAG]   ✗ 去重: 子块内容重复，跳过`)
        continue
      }
      seenContents.add(result.content)
    }
    dedupedResults.push(result)
  }

  console.log(`[RAG] ====== 检索结束，最终返回 ${dedupedResults.length} 条结果（去重前 ${finalResults.length} 条）======`)
  return dedupedResults
}
