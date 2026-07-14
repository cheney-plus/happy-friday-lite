import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { loadConfig, getDataDir } from '../config.js'
import { getDefaultModelConfig, isDefaultModelAvailable } from '../defaultModel.js'

let cachedEmbeddings = null
let cachedModelId = null
// 缓存的向量维度（首次探针后复用，避免重复 API 调用）
let cachedDimension = null

// 记录上次使用的 embedding 模型签名（用于检测变更并清除旧索引）
const EMBEDDING_SIG_FILE = 'embedding_model_sig.txt'

/**
 * 从 config.json 中读取首选模型配置，获取 Embedding 模型信息
 * Embedding 模型配置来自模型设置中的自定义模型
 * 如果没有自定义模型，回退到系统默认模型（需有试用次数）
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

  // 回退到系统默认模型（需有试用次数）
  if (!selectedModel) {
    if (!isDefaultModelAvailable()) {
      throw new Error('RAG: 系统默认模型试用次数已用尽，请在模型设置中添加自己的模型并配置 Embedding 模型名称')
    }
    const defaultModel = getDefaultModelConfig()
    return {
      apiKey: defaultModel.apiKey,
      baseUrl: defaultModel.baseUrl,
      embeddingModelName: defaultModel.embeddingModelName,
      modelId: defaultModel.id,
      rawUrl: defaultModel.provider === 'other'
    }
  }

  if (!selectedModel.embeddingModelName) {
    throw new Error('RAG: 当前首选模型未配置 Embedding 模型名称，请在模型设置中为模型添加 Embedding 模型')
  }

  // 仅“其他”厂商可选择为 Embedding 模型单独配置地址与 API Key
  const useSeparate = selectedModel.useSeparateEmbeddingConfig &&
    selectedModel.embeddingApiKey && selectedModel.embeddingBaseUrl

  return {
    apiKey: useSeparate ? selectedModel.embeddingApiKey : selectedModel.apiKey,
    baseUrl: useSeparate ? selectedModel.embeddingBaseUrl : selectedModel.baseUrl,
    embeddingModelName: selectedModel.embeddingModelName,
    modelId: selectedModel.id,
    // “其他”厂商的地址为完整 URL，不做 /embeddings 路径拼接
    rawUrl: selectedModel.provider === 'other'
  }
}

// 单次 Embedding API 请求超时时间（毫秒）
const EMBEDDING_HTTP_TIMEOUT = 60_000
// 最大重试次数（不含首次请求）
const EMBEDDING_MAX_RETRIES = 3

/**
 * 通过 HTTPS 调用 Embedding API
 * 兼容 OpenAI /embeddings 接口格式
 * 多模态 Embedding 模型（如 doubao-embedding-vision-251215）使用 /embeddings/multimodal 端点，
 * 输入格式为 [{type: "text", text: "..."}]
 */
function callEmbeddingApi(baseUrl, apiKey, modelName, texts, rawUrl) {
  const isMultimodal = /vision/i.test(modelName)

  let fullUrl
  if (rawUrl) {
    fullUrl = baseUrl
  } else if (isMultimodal) {
    fullUrl = `${baseUrl.replace(/\/+$/, '')}/embeddings/multimodal`
  } else {
    fullUrl = `${baseUrl.replace(/\/+$/, '')}/embeddings`
  }
  const url = new URL(fullUrl)

  // 多模态端点每次调用仅返回单个向量，故每次只发送 texts[0]
  const body = JSON.stringify({
    model: modelName,
    input: isMultimodal
      ? [{ type: 'text', text: texts[0] }]
      : texts
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
          let embeddings
          if (Array.isArray(parsed.data)) {
            // 标准 OpenAI 格式：data 为数组 [{index, embedding}]
            embeddings = parsed.data
              .sort((a, b) => a.index - b.index)
              .map(item => item.embedding)
          } else if (parsed.data && parsed.data.embedding) {
            // 多模态格式：data 为单个对象 {embedding, object}
            embeddings = [parsed.data.embedding]
          } else {
            embeddings = []
          }
          resolve(embeddings)
        } catch (e) {
          reject(new Error(`Embedding API parse error: ${e.message}`))
        }
      })
    })

    // 超时保护：防止大文件请求或网络异常导致无限挂起
    req.setTimeout(EMBEDDING_HTTP_TIMEOUT, () => {
      req.destroy(new Error(`Embedding API timeout after ${EMBEDDING_HTTP_TIMEOUT / 1000}s`))
    })

    req.on('error', (err) => {
      reject(new Error(`Embedding API request error: ${err.message}`))
    })

    req.write(body)
    req.end()
  })
}

/**
 * 带重试的 Embedding API 调用
 * 大文件会产生大量 embedding 请求，单次瞬时失败（限流、网络抖动）不应导致整文件索引失败。
 * 采用指数退避重试策略。
 */
async function callEmbeddingApiWithRetry(baseUrl, apiKey, modelName, texts, rawUrl) {
  let lastError
  for (let attempt = 0; attempt <= EMBEDDING_MAX_RETRIES; attempt++) {
    try {
      return await callEmbeddingApi(baseUrl, apiKey, modelName, texts, rawUrl)
    } catch (e) {
      lastError = e
      if (attempt < EMBEDDING_MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt) // 1s, 2s, 4s
        console.warn(`[RAG] Embedding API attempt ${attempt + 1} failed: ${e.message}, retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
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
    this.rawUrl = config.rawUrl
  }

  /**
   * 批量文本向量化
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedDocuments(texts) {
    if (!texts || texts.length === 0) return []

    // 多模态模型每次调用仅返回单个向量，batch size 必须为 1
    const batchSize = /vision/i.test(this.modelName) ? 1 : 10
    const allEmbeddings = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const embeddings = await callEmbeddingApiWithRetry(this.baseUrl, this.apiKey, this.modelName, batch, this.rawUrl)
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
    const embeddings = await callEmbeddingApiWithRetry(this.baseUrl, this.apiKey, this.modelName, [text], this.rawUrl)
    // L2 归一化，与 embedDocuments 保持一致
    return normalizeVector(embeddings[0])
  }
}

/**
 * 检测 Embedding 模型是否变更，如果变更则删除所有旧的向量索引
 * 因为不同模型的向量维度不同，旧索引无法兼容
 */
async function checkModelChangeAndCleanIndex(modelConfig) {
  // 签名包含模型信息和向量库版本号，版本变更会强制清除旧索引
  // zvec_v1: 使用 Zvec HNSW + COSINE 度量（替代旧的 faiss-node + cosine_v1）
  const sig = `${modelConfig.baseUrl}|${modelConfig.embeddingModelName}|zvec_v1`
  const dataDir = getDataDir()
  const sigFile = path.join(dataDir, 'rag', EMBEDDING_SIG_FILE)

  try {
    if (fs.existsSync(sigFile)) {
      const oldSig = fs.readFileSync(sigFile, 'utf-8').trim()
      if (oldSig === sig) return // 模型未变，无需清理
      console.log(`[RAG] Embedding model changed: ${oldSig} → ${sig}, clearing old indexes`)
    }

    // 模型变更，关闭并清除 Zvec collection 缓存
    try {
      const { clearStoreCache } = await import('./vectorstore.js')
      clearStoreCache()
    } catch (e) { /* ignore */ }

    // 删除 Zvec 索引目录（所有知识库共用一个 collection）
    const zvecDir = path.join(dataDir, 'rag', 'zvec_index')
    if (fs.existsSync(zvecDir)) {
      fs.rmSync(zvecDir, { recursive: true, force: true })
      console.log(`[RAG] Deleted old zvec index: ${zvecDir}`)
    }

    // 兼容：清除旧的 FaissStore 索引目录（cosine_v1 时代）
    for (const kbType of ['personal', 'local']) {
      const oldFaissDir = path.join(dataDir, 'rag', kbType, 'faiss_index')
      if (fs.existsSync(oldFaissDir)) {
        fs.rmSync(oldFaissDir, { recursive: true, force: true })
        console.log(`[RAG] Deleted legacy faiss index: ${oldFaissDir}`)
      }
    }

    // 重置缓存的维度（模型变了维度可能不同）
    cachedDimension = null

    // 同步清除 file_status 表中的索引状态记录
    // 否则系统会误认为文件已索引，跳过重新索引
    try {
      const db = await import('../db.js')
      for (const kbType of ['personal', 'local']) {
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
 * 探针获取当前 Embedding 模型的向量维度
 * 首次调用会发起一次 embedQuery 请求并缓存结果，后续直接返回缓存值。
 * 用于创建 Zvec collection 时确定 schema 中的 dimension 字段。
 * @param {HttpApiEmbeddings} embeddings
 * @returns {Promise<number>}
 */
export async function getEmbeddingDimension(embeddings) {
  if (cachedDimension && cachedDimension > 0) {
    return cachedDimension
  }
  const probe = await embeddings.embedQuery('dimension probe')
  if (!probe || !probe.length) {
    throw new Error('RAG: embedding 探针返回空向量')
  }
  cachedDimension = probe.length
  console.log(`[RAG] Detected embedding dimension: ${cachedDimension}`)
  return cachedDimension
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
  cachedDimension = null
  // 延迟导入避免循环依赖
  import('./vectorstore.js').then(m => m.clearStoreCache()).catch(() => {})
}
