import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { loadConfig, getDataDir } from '../config.js'

let cachedEmbeddings = null
let cachedModelId = null

// 记录上次使用的 embedding 模型签名（用于检测变更并清除旧索引）
const EMBEDDING_SIG_FILE = 'embedding_model_sig.txt'

/**
 * 从 config.json 中读取首选模型配置，获取 Embedding 模型信息
 * Embedding 模型配置来自模型设置中的自定义模型
 */
function getEmbeddingModelConfig() {
  const config = loadConfig()
  const customModels = config.customModels || []
  const selectedModelId = config.selectedModelId

  // 找到首选模型
  let selectedModel = null
  if (selectedModelId) {
    selectedModel = customModels.find(m => m.id === selectedModelId)
  }
  // 如果没找到首选模型，取第一个有 embeddingModelName 的模型
  if (!selectedModel) {
    selectedModel = customModels.find(m => m.embeddingModelName)
  }
  // 如果还是没有，取第一个模型
  if (!selectedModel && customModels.length > 0) {
    selectedModel = customModels[0]
  }

  if (!selectedModel) {
    throw new Error('RAG: 未配置模型，请先在模型设置中添加模型并配置 Embedding 模型名称')
  }

  if (!selectedModel.embeddingModelName) {
    throw new Error('RAG: 当前首选模型未配置 Embedding 模型名称，请在模型设置中为模型添加 Embedding 模型')
  }

  return {
    apiKey: selectedModel.apiKey,
    baseUrl: selectedModel.baseUrl,
    embeddingModelName: selectedModel.embeddingModelName,
    modelId: selectedModel.id
  }
}

/**
 * 通过 HTTPS 调用 Embedding API
 * 兼容 OpenAI /embeddings 接口格式
 */
function callEmbeddingApi(baseUrl, apiKey, modelName, texts) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/embeddings`)

  const body = JSON.stringify({
    model: modelName,
    input: texts
  })

  const isHttps = url.protocol === 'https:'
  const client = isHttps ? https : http

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk.toString() })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Embedding API request failed (${res.statusCode}): ${data}`))
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) {
            reject(new Error(`Embedding API error: ${parsed.error.message || JSON.stringify(parsed.error)}`))
            return
          }
          // 按 index 排序确保顺序正确
          const embeddings = (parsed.data || [])
            .sort((a, b) => a.index - b.index)
            .map(item => item.embedding)
          resolve(embeddings)
        } catch (e) {
          reject(new Error(`Embedding API parse error: ${e.message}`))
        }
      })
    })

    req.on('error', (err) => {
      reject(new Error(`Embedding API request error: ${err.message}`))
    })

    req.write(body)
    req.end()
  })
}

/**
 * L2 归一化：将向量缩放为单位长度（模长为 1）
 * 归一化后 Faiss L2 距离可精确转换为余弦相似度
 * @param {number[]} vec
 * @returns {number[]}
 */
function normalizeVector(vec) {
  if (!vec || vec.length === 0) return vec
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  return vec.map(v => v / norm)
}

/**
 * 自定义 Embeddings 类，实现 LangChain Embeddings 接口
 * 通过 HTTPS API 调用获取向量
 */
class HttpApiEmbeddings {
  constructor(config) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this.modelName = config.embeddingModelName
    this.modelId = config.modelId
  }

  /**
   * 批量文本向量化
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedDocuments(texts) {
    if (!texts || texts.length === 0) return []

    // 分批处理，每批最多 10 条（部分 API 如千问限制 batch size ≤ 10）
    const batchSize = 10
    const allEmbeddings = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const embeddings = await callEmbeddingApi(this.baseUrl, this.apiKey, this.modelName, batch)
      allEmbeddings.push(...embeddings)
    }

    // L2 归一化：使所有向量为单位长度，这样 Faiss L2 距离可转换为余弦相似度
    // cosine_similarity = 1 - (L2_distance^2 / 2)  （当向量归一化时）
    return allEmbeddings.map(vec => normalizeVector(vec))
  }

  /**
   * 单条文本向量化
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async embedQuery(text) {
    const embeddings = await callEmbeddingApi(this.baseUrl, this.apiKey, this.modelName, [text])
    // L2 归一化，与 embedDocuments 保持一致
    return normalizeVector(embeddings[0])
  }
}

/**
 * 检测 Embedding 模型是否变更，如果变更则删除所有旧的 FaissStore 索引
 * 因为不同模型的向量维度不同，旧索引无法兼容
 */
async function checkModelChangeAndCleanIndex(modelConfig) {
  // 签名包含模型信息和余弦相似度版本号，版本变更会强制清除旧索引
  // cosine_v1: 使用 IndexFlatIP + L2 归一化实现余弦相似度（替代旧的 IndexFlatL2）
  const sig = `${modelConfig.baseUrl}|${modelConfig.embeddingModelName}|cosine_v1`
  const dataDir = getDataDir()
  const sigFile = path.join(dataDir, 'rag', EMBEDDING_SIG_FILE)

  try {
    if (fs.existsSync(sigFile)) {
      const oldSig = fs.readFileSync(sigFile, 'utf-8').trim()
      if (oldSig === sig) return // 模型未变，无需清理
      console.log(`[RAG] Embedding model changed: ${oldSig} → ${sig}, clearing old indexes`)
    }

    // 模型变更，删除所有 FaissStore 索引
    for (const kbType of ['personal', 'agent', 'local']) {
      const storeDir = path.join(dataDir, 'rag', kbType, 'faiss_index')
      if (fs.existsSync(storeDir)) {
        fs.rmSync(storeDir, { recursive: true, force: true })
        console.log(`[RAG] Deleted old index: ${storeDir}`)
      }
    }

    // 同步清除 file_status 表中的索引状态记录
    // 否则系统会误认为文件已索引，跳过重新索引
    try {
      const db = await import('../db.js')
      for (const kbType of ['personal', 'agent', 'local']) {
        db.deleteFileStatusByKbType(kbType)
      }
      console.log(`[RAG] Cleared file_status for all kb types (signature changed)`)
    } catch (e) {
      console.warn(`[RAG] Failed to clear file_status:`, e.message)
    }

    // 写入新签名
    fs.mkdirSync(path.dirname(sigFile), { recursive: true })
    fs.writeFileSync(sigFile, sig, 'utf-8')
  } catch (e) {
    console.warn('[RAG] Failed to check/clean embedding model signature:', e.message)
  }
}

/**
 * 创建 Embedding 模型实例
 * 从 config.json 中读取自定义模型配置，使用 HTTPS API 调用
 */
export async function getEmbeddings() {
  const modelConfig = getEmbeddingModelConfig()

  // 如果已缓存且模型未变，直接返回
  if (cachedEmbeddings && cachedModelId === modelConfig.modelId) {
    return cachedEmbeddings
  }

  // 检测模型变更，清除不兼容的旧索引
  await checkModelChangeAndCleanIndex(modelConfig)

  cachedEmbeddings = new HttpApiEmbeddings(modelConfig)
  cachedModelId = modelConfig.modelId

  return cachedEmbeddings
}

// 清除缓存的 embeddings 实例（配置变更时调用）
export function clearEmbeddingsCache() {
  cachedEmbeddings = null
  cachedModelId = null
  // 延迟导入避免循环依赖
  import('./vectorstore.js').then(m => m.clearStoreCache()).catch(() => {})
}
