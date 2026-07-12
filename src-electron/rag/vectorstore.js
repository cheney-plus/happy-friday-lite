import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import {
  ZVecCollectionSchema,
  ZVecCreateAndOpen,
  ZVecOpen,
  ZVecDataType,
  ZVecIndexType,
  ZVecMetricType
} from '@zvec/zvec'
import { getEmbeddings, getEmbeddingDimension } from './embeddings.js'
import { getDataDir } from '../config.js'

/**
 * Zvec 向量存储管理
 *
 * 与旧的 FaissStore 实现的关键差异：
 *   - 个人知识库 (personal) 与本地知识库 (local) 的所有文档向量统一存放在【同一个】 Zvec collection 中，
 *     通过标量字段 kb_type 区分归属；工作区 (agent) 不参与向量化。
 *   - 使用 Zvec HNSW 索引 + COSINE 距离度量，向量无需手动 L2 归一化（embeddings.js 仍保留归一化，结果一致）。
 *   - Zvec 的 query 返回的 score 为余弦【距离】（越小越相似），需用 1 - score 转换为相似度/置信度。
 *   - Zvec 支持按标量过滤高效删除（deleteByFilterSync），无需像 Faiss 那样整体重建以避免碎片化。
 *   - 数据落盘在 {dataDir}/rag/zvec_index/，插入后立即持久化，无需显式 save。
 */

// 参与向量化的知识库类型（工作区 agent 不参与）
export const KB_TYPES = ['personal', 'local']

// 向量字段名（schema 中定义，后续 insert/query 必须严格使用此名称）
const VECTOR_FIELD = 'embedding'

// 标量字段名
const FIELD_KB_TYPE = 'kb_type'
const FIELD_SOURCE = 'source'
const FIELD_DOC_ID = 'doc_id'
const FIELD_CONTENT = 'content'
const FIELD_FILE_TYPE = 'file_type'
const FIELD_TITLE = 'title'
const FIELD_NOTE_ID = 'note_id'

// 内存中缓存的 Zvec collection 实例（所有知识库共用一个）
let collectionCache = null

/**
 * 获取 Zvec collection 的存储目录（所有知识库共用）
 */
export function getStoreDir() {
  const dataDir = getDataDir()
  return path.join(dataDir, 'rag', 'zvec_index')
}

/**
 * 构造 collection schema
 * @param {number} dimension - 向量维度（由 embedding 模型决定）
 */
function buildSchema(dimension) {
  return new ZVecCollectionSchema({
    name: 'knowledge',
    fields: [
      // kb_type 必填且建倒排索引，用于按知识库类型过滤检索/删除
      {
        name: FIELD_KB_TYPE,
        dataType: ZVecDataType.STRING,
        indexParams: { indexType: ZVecIndexType.INVERT }
      },
      // source（文件路径）建倒排索引，用于按文件删除旧向量、避免重复
      {
        name: FIELD_SOURCE,
        dataType: ZVecDataType.STRING,
        nullable: true,
        indexParams: { indexType: ZVecIndexType.INVERT }
      },
      { name: FIELD_DOC_ID, dataType: ZVecDataType.STRING, nullable: true },
      // content（子块文本）用于检索后回填子块内容（父块缺失时的兜底）
      { name: FIELD_CONTENT, dataType: ZVecDataType.STRING, nullable: true },
      { name: FIELD_FILE_TYPE, dataType: ZVecDataType.STRING, nullable: true },
      { name: FIELD_TITLE, dataType: ZVecDataType.STRING, nullable: true },
      { name: FIELD_NOTE_ID, dataType: ZVecDataType.STRING, nullable: true }
    ],
    vectors: [
      {
        name: VECTOR_FIELD,
        dataType: ZVecDataType.VECTOR_FP32,
        dimension,
        indexParams: { indexType: ZVecIndexType.HNSW, metricType: ZVecMetricType.COSINE }
      }
    ]
  })
}

/**
 * 判断目录是否已经是一个已创建的 Zvec collection（目录非空即认为已存在）
 */
function collectionExists(storeDir) {
  try {
    return fs.existsSync(storeDir) && fs.readdirSync(storeDir).length > 0
  } catch (e) {
    return false
  }
}

/**
 * 加载（或创建并打开）唯一的 Zvec collection
 *
 * 流程：
 *   1. 若已缓存则直接返回
 *   2. 若目录已存在 collection 数据则 ZVecOpen 打开
 *   3. 否则探针一次 embedding 取得维度，构造 schema 后 ZVecCreateAndOpen 创建
 *
 * @param {boolean} forceReload - 是否强制重新打开（忽略缓存）
 * @returns {Promise<ZVecCollection>}
 */
export async function loadStore(forceReload = false) {
  if (!forceReload && collectionCache) {
    return collectionCache
  }

  // 若之前缓存了实例，先关闭释放资源
  if (collectionCache) {
    try { collectionCache.closeSync() } catch (e) { /* ignore */ }
    collectionCache = null
  }

  // getEmbeddings 内部会检测模型变更并清理不兼容的旧索引
  const embeddings = await getEmbeddings()
  const storeDir = getStoreDir()
  // 仅确保父目录存在，collection 目录由 ZVecCreateAndOpen 自行创建
  // （ZVecCreateAndOpen 要求目标路径不存在，否则会报 "path exists"）
  fs.mkdirSync(path.dirname(storeDir), { recursive: true })

  let collection
  if (collectionExists(storeDir)) {
    collection = ZVecOpen(storeDir)
  } else {
    // 若残留空目录（异常中断等场景），先清理以便 ZVecCreateAndOpen 创建
    if (fs.existsSync(storeDir)) {
      fs.rmSync(storeDir, { recursive: true, force: true })
    }
    // 首次创建：探针获取维度
    const dimension = await getEmbeddingDimension(embeddings)
    if (!dimension || dimension <= 0) {
      throw new Error('RAG: 无法确定 embedding 维度，请检查模型配置')
    }
    collection = ZVecCreateAndOpen(storeDir, buildSchema(dimension))
  }

  collectionCache = collection
  return collection
}

/**
 * 转义 filter 表达式中的字符串字面量（单引号 -> '' ）
 */
function escapeFilterString(value) {
  return String(value == null ? '' : value).replace(/'/g, "''")
}

/**
 * 构造 "field = 'value'" 的过滤片段
 */
function eqFilter(field, value) {
  return `${field} = '${escapeFilterString(value)}'`
}

/**
 * 构造多个 source 的 OR 过滤：source = 'a' OR source = 'b' ...
 */
function sourcesOrFilter(sourcePaths) {
  return sourcePaths.map(p => eqFilter(FIELD_SOURCE, p)).join(' OR ')
}

/**
 * 将 LangChain 风格的子块 Document 转为 Zvec 输入文档
 * @param {object} childDoc - 含 pageContent 与 metadata 的子块
 * @param {string} kbType
 * @param {number[]} vector - 已 embedding 的向量
 */
function toZvecDoc(childDoc, kbType, vector) {
  const meta = childDoc.metadata || {}
  return {
    id: crypto.randomUUID(),
    vectors: { [VECTOR_FIELD]: vector },
    fields: {
      [FIELD_KB_TYPE]: kbType,
      [FIELD_SOURCE]: meta.source || '',
      [FIELD_DOC_ID]: meta.docId || '',
      [FIELD_CONTENT]: childDoc.pageContent || '',
      [FIELD_FILE_TYPE]: meta.fileType || '',
      [FIELD_TITLE]: meta.title || '',
      [FIELD_NOTE_ID]: meta.noteId || ''
    }
  }
}

/**
 * 将 Zvec 返回的 Doc 还原为检索流程使用的结构
 */
function fromZvecDoc(zDoc) {
  const fields = zDoc.fields || {}
  return {
    doc: {
      pageContent: fields[FIELD_CONTENT] || '',
      metadata: {
        source: fields[FIELD_SOURCE] || '',
        docId: fields[FIELD_DOC_ID] || '',
        fileType: fields[FIELD_FILE_TYPE] || '',
        title: fields[FIELD_TITLE] || '',
        noteId: fields[FIELD_NOTE_ID] || ''
      }
    },
    score: zDoc.score,
    kbType: fields[FIELD_KB_TYPE] || ''
  }
}

// 单次 embed+insert 的批次大小，与 embedDocuments 内部的 API 批次对齐
// 这样单批失败（API 重试耗尽后）最多只丢 10 个块，且不浪费已成功的 embedding 工作
const EMBED_INSERT_BATCH = 10

/**
 * 向指定知识库添加子块文档（向量）
 *
 * 为避免同一文件重复索引产生重复向量，会先按 source 删除该文件已有的旧向量，
 * 再分批 embedding 并插入。插入后立即可检索（暂存于临时索引），无需 optimize。
 *
 * 大文件（如数百页 PDF 会产生数千子块）采用分批 embed+insert 策略：
 *   - 避免将全部向量一次性堆积在内存中导致 OOM
 *   - 每批独立 try/catch：单批 embedding 或插入失败只跳过该批，不影响其余批次
 *   - embedDocuments 内部已带指数退避重试，重试耗尽才视为该批失败
 *   - 支持取消：每批处理前检查 isCancelled()，取消后提前返回（队列负责清理已插入的向量）
 *
 * @param {string} kbType
 * @param {Array} childDocs - Document 数组，metadata 中含 docId 指向父块
 * @param {(currentChunk: number, totalChunks: number) => void} [onProgress] - 分块处理进度回调
 * @param {() => boolean} [isCancelled] - 取消检查函数，返回 true 时提前终止
 * @returns {Promise<number>} 实际插入的文档数（可能小于 childDocs.length）
 */
export async function addDocuments(kbType, childDocs, onProgress = null, isCancelled = null) {
  if (!childDocs || childDocs.length === 0) return 0

  const collection = await loadStore()

  // 1. 收集本次涉及的所有 source，删除这些文件已有的旧向量（防止重复索引产生重复）
  const sources = [...new Set(childDocs.map(d => (d.metadata && d.metadata.source) || '').filter(Boolean))]
  if (sources.length > 0) {
    try {
      collection.deleteByFilterSync(sourcesOrFilter(sources))
      console.log(`[RAG] Deleted old vectors for ${sources.length} source(s)`)
    } catch (e) {
      console.warn(`[RAG] deleteByFilter for sources failed (ignored):`, e.message)
    }
  }

  // 2. 分批 embedding + 插入，每批独立容错
  const embeddings = await getEmbeddings()
  let totalInserted = 0
  let totalSkipped = 0
  const totalChunks = childDocs.length
  const totalBatches = Math.ceil(totalChunks / EMBED_INSERT_BATCH)
  console.log(`[RAG] Starting embedding: ${totalChunks} chunks, ${totalBatches} batches (kb=${kbType})`)

  for (let i = 0; i < childDocs.length; i += EMBED_INSERT_BATCH) {
    // 取消检查点：每批处理前检查
    if (isCancelled && isCancelled()) {
      console.log(`[RAG] Cancelled at batch ${Math.floor(i / EMBED_INSERT_BATCH) + 1}/${totalBatches}, inserted so far: ${totalInserted}`)
      break
    }

    const batchIdx = Math.floor(i / EMBED_INSERT_BATCH)
    const batch = childDocs.slice(i, i + EMBED_INSERT_BATCH)
    try {
      const texts = batch.map(d => d.pageContent || '')
      // embedDocuments 内部按 10 条/批调用 API，并带指数退避重试
      const vectors = await embeddings.embedDocuments(texts)

      const zDocs = batch.map((doc, j) => toZvecDoc(doc, kbType, vectors[j]))
      const results = collection.insertSync(zDocs)
      const failed = Array.isArray(results) ? results.filter(r => !r.ok) : []
      const inserted = (Array.isArray(results) ? results.length : 0) - failed.length
      totalInserted += inserted
      totalSkipped += failed.length

      console.log(`[RAG] Batch ${batchIdx + 1}/${totalBatches}: inserted ${inserted}/${batch.length} (total: ${totalInserted}/${totalChunks})`)

      if (failed.length > 0) {
        console.warn(`[RAG] Batch ${batchIdx + 1}/${totalBatches}: ${failed.length}/${results.length} docs failed to insert`)
      }
    } catch (e) {
      // 单批 embedding 或插入失败：跳过该批，继续处理后续批次
      totalSkipped += batch.length
      console.warn(`[RAG] Batch ${batchIdx + 1}/${totalBatches} (offset ${i}, ${batch.length} chunks) failed: ${e.message}, skipping`)
    }

    // 通知分块进度
    if (onProgress) {
      onProgress(Math.min(i + EMBED_INSERT_BATCH, totalChunks), totalChunks)
    }
  }

  console.log(`[RAG] Embedding done: inserted ${totalInserted}/${childDocs.length} (kb=${kbType}, skipped: ${totalSkipped})`)

  // 若有子块但全部插入失败，抛出异常使调用方标记任务为 failed
  // 单批失败仍容错跳过，但全部失败说明存在系统性问题（如 API 不可用、模型配置错误）
  if (totalInserted === 0 && childDocs.length > 0 && !(isCancelled && isCancelled())) {
    throw new Error(`向量化失败：${childDocs.length} 个子块全部未插入（跳过 ${totalSkipped} 个），请检查 Embedding 模型配置与网络连接`)
  }

  return totalInserted
}

/**
 * 检查 collection 是否已存在（内存缓存或磁盘上有数据）。
 * 用于 delete/optimize 等操作的前置判断，避免为空操作而强制创建 collection。
 */
function isStoreReady() {
  if (collectionCache) return true
  try {
    return collectionExists(getStoreDir())
  } catch (e) {
    return false
  }
}

/**
 * 删除指定知识库在该 collection 中的全部向量（按 kb_type 过滤删除）
 * @param {string} kbType
 */
export async function deleteStore(kbType) {
  if (!isStoreReady()) return
  const collection = await loadStore()
  try {
    collection.deleteByFilterSync(eqFilter(FIELD_KB_TYPE, kbType))
  } catch (e) {
    console.warn(`[RAG] deleteStore(${kbType}) failed:`, e.message)
  }
}

/**
 * 按 source 路径删除对应的向量（用于文件被删除时清理）
 * @param {string} sourcePath
 */
export async function deleteBySource(sourcePath) {
  if (!isStoreReady()) return
  const collection = await loadStore()
  try {
    collection.deleteByFilterSync(eqFilter(FIELD_SOURCE, sourcePath))
  } catch (e) {
    console.warn(`[RAG] deleteBySource(${sourcePath}) failed:`, e.message)
  }
}

/**
 * 优化 collection 索引（将临时索引中的新向量构建为完整 HNSW 索引，加速检索）
 * 建议在批量重建后调用。
 */
export async function optimizeCollection() {
  if (!isStoreReady()) return
  const collection = await loadStore()
  try {
    await collection.optimize()
  } catch (e) {
    console.warn(`[RAG] optimize failed:`, e.message)
  }
}

/**
 * 从 collection 中提取指定 source 文件对应的子块文档（用于重建时复用未变更文件的向量）
 *
 * 注意：当前重建策略已改为"按变更文件增量删除+重插"，未变更文件向量原位保留，
 * 此函数仅供需要时使用，默认不再调用。
 *
 * @param {string[]} sourcePaths
 * @returns {Promise<Array>} Document 数组（含 pageContent 与 metadata）
 */
export async function extractDocsBySources(sourcePaths) {
  if (!sourcePaths || sourcePaths.length === 0) return []
  const collection = await loadStore()
  try {
    const zDocs = collection.querySync({
      filter: sourcesOrFilter(sourcePaths),
      topk: 1000000,
      outputFields: [
        FIELD_KB_TYPE, FIELD_SOURCE, FIELD_DOC_ID, FIELD_CONTENT,
        FIELD_FILE_TYPE, FIELD_TITLE, FIELD_NOTE_ID
      ]
    })
    return zDocs.map(fromZvecDoc).map(r => ({
      pageContent: r.doc.pageContent,
      metadata: r.doc.metadata
    }))
  } catch (e) {
    console.warn(`[RAG] extractDocsBySources failed:`, e.message)
    return []
  }
}

/**
 * 向量相似度检索
 *
 * @param {string} queryText - 查询文本
 * @param {string[]} kbTypes - 限定检索的知识库类型（如 ['personal','local'] 或 ['personal']）
 * @param {number} topK - 返回结果数上限
 * @returns {Promise<Array<{doc, score, kbType}>>}
 *   - doc: { pageContent, metadata:{source, docId, fileType, title, noteId} }
 *   - score: Zvec 返回的余弦【距离】（越小越相似）
 *   - kbType: 命中文档所属知识库类型
 */
export async function searchByQuery(queryText, kbTypes, topK) {
  const collection = await loadStore()
  const embeddings = await getEmbeddings()
  const vector = await embeddings.embedQuery(queryText)

  // 构造 kb_type 过滤表达式
  const kbFilter = kbTypes.map(t => eqFilter(FIELD_KB_TYPE, t)).join(' OR ')

  const zDocs = collection.querySync({
    fieldName: VECTOR_FIELD,
    vector,
    topk: topK,
    filter: kbFilter,
    includeVector: false,
    outputFields: [
      FIELD_KB_TYPE, FIELD_SOURCE, FIELD_DOC_ID, FIELD_CONTENT,
      FIELD_FILE_TYPE, FIELD_TITLE, FIELD_NOTE_ID
    ]
  })

  return zDocs.map(fromZvecDoc)
}

/**
 * 获取 collection 中文档总数（所有知识库合计）
 */
export async function getTotalDocCount() {
  try {
    const collection = await loadStore()
    return collection.stats?.docCount || 0
  } catch (e) {
    return 0
  }
}

/**
 * 关闭并清除缓存的 collection 实例（模型配置变更时调用）
 */
export function clearStoreCache() {
  if (collectionCache) {
    try { collectionCache.closeSync() } catch (e) { /* ignore */ }
    collectionCache = null
  }
}
