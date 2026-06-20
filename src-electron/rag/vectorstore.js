import fs from 'fs'
import path from 'path'
import { FaissStore } from '@langchain/community/vectorstores/faiss'
import { getEmbeddings } from './embeddings.js'
import { getDataDir } from '../config.js'

/**
 * FaissStore 向量存储管理
 * 维护三个独立的 FaissStore 数据库，分别对应 personal / agent / local 知识库
 * 存储路径: {dataDir}/rag/{kbType}/faiss_index/
 */

// 三个知识库类型
export const KB_TYPES = ['personal', 'agent', 'local']

// 内存中缓存的 FaissStore 实例
const storeCache = new Map()

// 获取指定知识库类型的 FaissStore 存储目录
export function getFaissStoreDir(kbType) {
  const dataDir = getDataDir()
  return path.join(dataDir, 'rag', kbType, 'faiss_index')
}

// 确保 FaissStore 目录存在
function ensureStoreDir(kbType) {
  const storeDir = getFaissStoreDir(kbType)
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true })
  }
  return storeDir
}

/**
 * 加载指定知识库的 FaissStore
 * 如果磁盘上存在已保存的索引则加载，否则创建空实例
 * @param {string} kbType - 知识库类型
 * @param {boolean} forceReload - 是否强制从磁盘重新加载
 * @returns {Promise<FaissStore>}
 */
export async function loadFaissStore(kbType, forceReload = false) {
  // 如果已缓存且不强制重载，直接返回
  if (!forceReload && storeCache.has(kbType)) {
    return storeCache.get(kbType)
  }

  const embeddings = await getEmbeddings()
  const storeDir = getFaissStoreDir(kbType)

  let store
  if (fs.existsSync(storeDir) && fs.existsSync(path.join(storeDir, 'faiss.index'))) {
    // 从磁盘加载已有索引
    store = await FaissStore.load(storeDir, embeddings)
  } else {
    // 创建空实例（用 fromTexts 初始化，避免 save 时报错）
    store = await FaissStore.fromTexts([''], [{}], embeddings)
  }

  storeCache.set(kbType, store)
  return store
}

/**
 * 保存指定知识库的 FaissStore 到磁盘
 * @param {string} kbType
 * @param {FaissStore} store - 可选，不传则使用缓存的实例
 */
export async function saveFaissStore(kbType, store = null) {
  const targetStore = store || storeCache.get(kbType)
  if (!targetStore) {
    throw new Error(`No FaissStore in cache for kbType: ${kbType}`)
  }
  const storeDir = ensureStoreDir(kbType)
  await targetStore.save(storeDir)
  storeCache.set(kbType, targetStore)
}

/**
 * 向指定知识库添加子块文档（向量）
 * @param {string} kbType
 * @param {Array} childDocs - Document 数组，metadata 中含 docId 指向父块
 * @returns {Promise<Array>} 返回添加的文档 ID 列表
 */
export async function addDocuments(kbType, childDocs) {
  const store = await loadFaissStore(kbType)
  const ids = await store.addDocuments(childDocs)
  await saveFaissStore(kbType, store)
  return ids
}

/**
 * 内存重建覆盖策略：
 * 比对状态库找出变更文件后，将该知识库中未发生改变的文件对应的向量加载到内存，
 * 加上修改后文件重新生成的向量，在内存中构建一个全新的 FaissStore，然后覆盖写入磁盘。
 * 这样彻底避免了在原索引上执行删除操作导致的文件膨胀和碎片化问题。
 *
 * @param {string} kbType - 知识库类型
 * @param {Array} newChildDocs - 所有需要保留的子块文档（未变更 + 重新生成的）
 * @returns {Promise<FaissStore>} 新构建的 FaissStore
 */
export async function rebuildStore(kbType, newChildDocs) {
  const embeddings = await getEmbeddings()
  const storeDir = ensureStoreDir(kbType)

  // 在内存中构建全新的 FaissStore
  let newStore
  if (newChildDocs.length > 0) {
    newStore = await FaissStore.fromDocuments(newChildDocs, embeddings)
  } else {
    // 没有文档时，用 fromTexts 创建空 store（new FaissStore() 未初始化无法 save）
    newStore = await FaissStore.fromTexts([''], [{}], embeddings)
    // 删除占位文档
    if (newStore.docstore && newStore.docstore._docs) {
      const docsMap = newStore.docstore._docs
      if (docsMap instanceof Map) {
        for (const id of docsMap.keys()) {
          docsMap.delete(id)
        }
      } else {
        for (const id of Object.keys(docsMap)) {
          delete docsMap[id]
        }
      }
    }
  }

  // 覆盖写入磁盘
  await newStore.save(storeDir)
  storeCache.set(kbType, newStore)
  return newStore
}

/**
 * 删除指定知识库的整个 FaissStore（清空索引）
 * @param {string} kbType
 */
export async function deleteFaissStore(kbType) {
  const storeDir = getFaissStoreDir(kbType)
  if (fs.existsSync(storeDir)) {
    fs.rmSync(storeDir, { recursive: true, force: true })
  }
  storeCache.delete(kbType)
}

/**
 * 清除所有缓存的 FaissStore 实例
 */
export function clearStoreCache() {
  storeCache.clear()
}

/**
 * 获取指定知识库 FaissStore 中的文档数量
 * @param {string} kbType
 * @returns {Promise<number>}
 */
export async function getStoreDocCount(kbType) {
  try {
    const store = await loadFaissStore(kbType)
    // FaissStore 内部 docstore._docs 是 Map
    if (store.docstore && store.docstore._docs) {
      const docsMap = store.docstore._docs
      if (docsMap instanceof Map) {
        return docsMap.size
      }
      return Object.keys(docsMap).length
    }
    return 0
  } catch (e) {
    console.error(`[RAG] Failed to get doc count for ${kbType}:`, e)
    return 0
  }
}
