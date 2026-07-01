/**
 * FAISS 向量检索测试脚本
 *
 * 用法: node scripts/test-faiss-search.mjs [查询文本]
 * 示例: node scripts/test-faiss-search.mjs "什么是RAG"
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { fileURLToPath } from 'url'
import { FaissStore } from '@langchain/community/vectorstores/faiss'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

// ==================== 配置读取 ====================

function loadConfig() {
  const dataDir = path.join(PROJECT_ROOT, 'app-data')
  const configPath = path.join(dataDir, 'config.json')
  if (!fs.existsSync(configPath)) {
    console.error('未找到 config.json，请先运行应用进行配置')
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
}

function getEmbeddingModelConfig() {
  const config = loadConfig()
  const customModels = config.customModels || []
  const selectedModelId = config.selectedModelId

  let selectedModel = null
  if (selectedModelId) {
    selectedModel = customModels.find(m => m.id === selectedModelId)
  }
  if (!selectedModel) {
    selectedModel = customModels.find(m => m.embeddingModelName)
  }
  if (!selectedModel && customModels.length > 0) {
    selectedModel = customModels[0]
  }

  if (!selectedModel || !selectedModel.embeddingModelName) {
    console.error('未配置 Embedding 模型名称，请先在模型设置中添加模型并配置 Embedding 模型名称')
    process.exit(1)
  }

  // 仅“其他”厂商可选择为 Embedding 模型单独配置地址与 API Key
  const useSeparate = selectedModel.useSeparateEmbeddingConfig &&
    selectedModel.embeddingApiKey && selectedModel.embeddingBaseUrl

  return {
    apiKey: useSeparate ? selectedModel.embeddingApiKey : selectedModel.apiKey,
    baseUrl: useSeparate ? selectedModel.embeddingBaseUrl : selectedModel.baseUrl,
    modelName: selectedModel.embeddingModelName,
    rawUrl: selectedModel.provider === 'other',
  }
}

// ==================== Embedding API 调用 ====================

function callEmbeddingApi(baseUrl, apiKey, modelName, texts, rawUrl) {
  const fullUrl = rawUrl ? baseUrl : `${baseUrl.replace(/\/+$/, '')}/embeddings`
  const url = new URL(fullUrl)
  const body = JSON.stringify({ model: modelName, input: texts })

  const isHttps = url.protocol === 'https:'
  const client = isHttps ? https : http

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk.toString() })
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`API 错误 (${res.statusCode}): ${data}`))
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              reject(new Error(parsed.error.message || JSON.stringify(parsed.error)))
              return
            }
            const embeddings = (parsed.data || [])
              .sort((a, b) => a.index - b.index)
              .map((item) => item.embedding)
            resolve(embeddings)
          } catch (e) {
            reject(new Error(`解析错误: ${e.message}`))
          }
        })
      },
    )
    req.on('error', (err) => reject(new Error(`请求错误: ${err.message}`)))
    req.write(body)
    req.end()
  })
}

class HttpApiEmbeddings {
  constructor(config) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this.modelName = config.modelName
    this.rawUrl = config.rawUrl
  }

  async embedDocuments(texts) {
    if (!texts || texts.length === 0) return []
    const batchSize = 10
    const allEmbeddings = []
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const embeddings = await callEmbeddingApi(this.baseUrl, this.apiKey, this.modelName, batch, this.rawUrl)
      allEmbeddings.push(...embeddings)
    }
    return allEmbeddings
  }

  async embedQuery(text) {
    const embeddings = await callEmbeddingApi(this.baseUrl, this.apiKey, this.modelName, [text], this.rawUrl)
    return embeddings[0]
  }
}

// ==================== 主流程 ====================

async function main() {
  const query = process.argv[2] || 'LangChain 文档加载器有哪些类型'

  // 1. 读取 Embedding 配置
  console.log('[1/4] 读取 Embedding 模型配置...')
  const modelConfig = getEmbeddingModelConfig()
  console.log(`       模型: ${modelConfig.modelName}`)
  console.log(`       接口: ${modelConfig.baseUrl}`)

  // 2. 创建 Embeddings 实例
  console.log('\n[2/4] 初始化 Embedding 模型...')
  const embeddings = new HttpApiEmbeddings(modelConfig)

  // 3. 加载 FaissStore
  const storeDir = path.join(PROJECT_ROOT, 'app-data/rag/personal/faiss_index')
  if (!fs.existsSync(path.join(storeDir, 'faiss.index'))) {
    console.error(`错误: 未找到索引文件: ${storeDir}`)
    process.exit(1)
  }
  console.log(`\n[3/4] 从磁盘加载 FaissStore...`)
  console.log(`       路径: ${storeDir}`)
  const store = await FaissStore.load(storeDir, embeddings)

  // 统计文档数
  let docCount = 0
  if (store.docstore && store.docstore._docs) {
    const docsMap = store.docstore._docs
    docCount = docsMap instanceof Map ? docsMap.size : Object.keys(docsMap).length
  }
  console.log(`       索引文档数: ${docCount}`)

  // 4. 相似度检索
  console.log(`\n[4/4] 执行检索...`)
  console.log(`       查询: "${query}"`)
  console.log(`       返回 Top 2 结果:\n`)

  const results = await store.similaritySearch(query, 2)

  for (let i = 0; i < results.length; i++) {
    const doc = results[i]
    console.log(`--- 结果 #${i + 1} ---`)
    console.log(`[内容]`)
    console.log(doc.pageContent.trim())
    console.log(`\n[元数据]`)
    for (const [key, value] of Object.entries(doc.metadata)) {
      console.log(`  ${key}: ${value}`)
    }
    console.log('')
  }

  console.log('检索完成。')
}

main().catch((e) => {
  console.error('执行失败:', e.message)
  process.exit(1)
})
