/**
 * RAG 知识检索测试脚本（余弦相似度版本 - IndexFlatIP）
 *
 * 测试内容：
 *   1. 向量 L2 归一化正确性
 *   2. IndexFlatIP 内积 = 余弦相似度（归一化向量）正确性
 *   3. FaissStore 检索 + 置信度过滤 + TOP 3
 *   4. 父块查表（Small-to-Big）
 *
 * 用法: node scripts/test-rag-search.mjs [查询文本] [知识库类型]
 * 示例: node scripts/test-rag-search.mjs "什么是RAG" personal
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { fileURLToPath } from 'url'
import { FaissStore } from '@langchain/community/vectorstores/faiss'
import { SynchronousInMemoryDocstore } from '@langchain/classic/stores/doc/in_memory'
import initSqlJs from 'sql.js'

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
    console.error('未配置 Embedding 模型名称')
    process.exit(1)
  }

  return {
    apiKey: selectedModel.apiKey,
    baseUrl: selectedModel.baseUrl,
    modelName: selectedModel.embeddingModelName,
  }
}

// ==================== Embedding API（带 L2 归一化）====================

function callEmbeddingApi(baseUrl, apiKey, modelName, texts) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/embeddings`)
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

/**
 * L2 归一化：将向量缩放为单位长度
 * 归一化后 IndexFlatIP 的内积 = 余弦相似度
 */
function normalizeVector(vec) {
  if (!vec || vec.length === 0) return vec
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  return vec.map(v => v / norm)
}

class HttpApiEmbeddings {
  constructor(config) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this.modelName = config.modelName
  }

  async embedDocuments(texts) {
    if (!texts || texts.length === 0) return []
    const batchSize = 10
    const allEmbeddings = []
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const embeddings = await callEmbeddingApi(this.baseUrl, this.apiKey, this.modelName, batch)
      allEmbeddings.push(...embeddings)
    }
    // L2 归一化
    return allEmbeddings.map(vec => normalizeVector(vec))
  }

  async embedQuery(text) {
    const embeddings = await callEmbeddingApi(this.baseUrl, this.apiKey, this.modelName, [text])
    // L2 归一化
    return normalizeVector(embeddings[0])
  }
}

// ==================== 余弦相似度 ====================

/**
 * 将 Faiss IndexFlatIP 返回的分数转换为置信度
 *
 * 使用 IndexFlatIP（内积索引）+ L2 归一化向量：
 *   - 归一化向量的内积 = 余弦相似度
 *   - 返回的 score 直接就是余弦相似度，无需转换
 *   - 范围 [-1, 1]，文本嵌入通常为 [0, 1]
 *
 * @param {number} score - IndexFlatIP 返回的内积分数（= 余弦相似度）
 * @returns {number} 置信度 [0, 1]
 */
function scoreToConfidence(score) {
  return Math.max(0, Math.min(1, score))
}

// ==================== 父块查表 ====================

let sqlDb = null

async function initDb() {
  const dbPath = path.join(PROJECT_ROOT, 'app-data', 'friday.db')
  if (!fs.existsSync(dbPath)) return null
  const SQL = await initSqlJs()
  const fileBuffer = fs.readFileSync(dbPath)
  sqlDb = new SQL.Database(fileBuffer)
  return sqlDb
}

function getParentDoc(docId) {
  if (!sqlDb) return null
  try {
    const stmt = sqlDb.prepare('SELECT * FROM parent_docs WHERE uuid = ?')
    stmt.bind([docId])
    let row = null
    if (stmt.step()) {
      row = stmt.getAsObject()
    }
    stmt.free()
    return row
  } catch (e) {
    return null
  }
}

// ==================== CosineFaissStore 加载 ====================

/**
 * 使用 IndexFlatIP 加载 FaissStore
 * 与项目 vectorstore.js 中的 CosineFaissStore.load 逻辑一致
 */
async function loadCosineFaissStore(storeDir, embeddings) {
  const { default: { IndexFlatIP } } = await import('faiss-node')

  // 读取 docstore.json
  const [docstoreFiles, mapping] = JSON.parse(
    fs.readFileSync(path.join(storeDir, 'docstore.json'), 'utf8')
  )

  // 使用 IndexFlatIP 读取索引（而非 IndexFlatL2）
  const index = IndexFlatIP.read(path.join(storeDir, 'faiss.index'))

  const docstore = new SynchronousInMemoryDocstore(new Map(docstoreFiles))
  return new FaissStore(embeddings, { docstore, index, mapping })
}

// ==================== 单元测试 ====================

function testNormalizeVector() {
  console.log('\n========== 单元测试: L2 归一化 ==========')
  const vec = [3, 4] // 模长 = 5
  const normalized = normalizeVector(vec)
  const norm = Math.sqrt(normalized.reduce((s, v) => s + v * v, 0))
  console.log(`  原始向量: [${vec}] → 模长=${Math.sqrt(vec.reduce((s, v) => s + v * v, 0))}`)
  console.log(`  归一化后: [${normalized.map(v => v.toFixed(4))}] → 模长=${norm.toFixed(6)}`)
  const passed = Math.abs(norm - 1.0) < 1e-10
  console.log(`  ${passed ? '✅ 通过' : '❌ 失败'}: 归一化后模长应为 1.0`)
  return passed
}

async function testIndexFlatIP() {
  console.log('\n========== 单元测试: IndexFlatIP 内积 = 余弦相似度 ==========')
  const { default: { IndexFlatIP } } = await import('faiss-node')

  // 创建 3 维内积索引
  const index = new IndexFlatIP(3)

  // 归一化向量
  const a = normalizeVector([1, 0, 0])       // [1, 0, 0]
  const b = normalizeVector([1, 1, 0])       // [0.707, 0.707, 0]
  const c = normalizeVector([1, 1, 1])       // [0.577, 0.577, 0.577]

  index.add(a)
  index.add(b)
  index.add(c)

  // 查询向量（归一化）
  const query = normalizeVector([1, 0, 0])   // 与 a 完全相同
  const result = index.search(query, 3)

  const expected = [
    { label: 0, score: 1.0, desc: 'a 与 query 完全相同 → cosine=1.0' },
    { label: 1, score: Math.SQRT1_2, desc: 'b 与 query 夹角45° → cosine=√2/2≈0.707' },
    { label: 2, score: 1 / Math.sqrt(3), desc: 'c 与 query 夹角≈54.7° → cosine=1/√3≈0.577' },
  ]

  let allPassed = true
  for (let i = 0; i < 3; i++) {
    const label = result.labels[i]
    const score = result.distances[i]
    const exp = expected.find(e => e.label === label)
    const passed = exp && Math.abs(score - exp.score) < 1e-5
    console.log(`  ${passed ? '✅' : '❌'} ${exp.desc}: score=${score.toFixed(6)} (期望=${exp.score.toFixed(6)})`)
    if (!passed) allPassed = false
  }

  // 验证 scoreToConfidence
  console.log(`\n  --- scoreToConfidence 验证 ---`)
  const confCases = [
    { score: 1.0, expected: 1.0, desc: '完全相似 (score=1.0)' },
    { score: 0.7, expected: 0.7, desc: '阈值边界 (score=0.7)' },
    { score: 0.0, expected: 0.0, desc: '正交 (score=0.0)' },
    { score: -0.5, expected: 0.0, desc: '负相关截断 (score=-0.5 → 0.0)' },
    { score: 1.5, expected: 1.0, desc: '超出上界截断 (score=1.5 → 1.0)' },
  ]
  for (const c of confCases) {
    const result = scoreToConfidence(c.score)
    const passed = Math.abs(result - c.expected) < 1e-6
    console.log(`  ${passed ? '✅' : '❌'} ${c.desc}: → confidence=${result.toFixed(6)} (期望=${c.expected})`)
    if (!passed) allPassed = false
  }

  return allPassed
}

// ==================== 集成测试：FaissStore 检索 ====================

async function testFaissSearch(query, kbType) {
  console.log(`\n========== 集成测试: FaissStore 检索 (kbType=${kbType}) ==========`)

  const storeDir = path.join(PROJECT_ROOT, `app-data/rag/${kbType}/faiss_index`)
  if (!fs.existsSync(path.join(storeDir, 'faiss.index'))) {
    console.log(`  ⚠️  跳过: 未找到索引文件 ${storeDir}`)
    console.log(`     注意：余弦相似度版本变更后需要重新索引知识库`)
    return null
  }

  console.log(`  [1/3] 初始化 Embedding 模型...`)
  const modelConfig = getEmbeddingModelConfig()
  console.log(`        模型: ${modelConfig.modelName}`)
  const embeddings = new HttpApiEmbeddings(modelConfig)

  console.log(`  [2/3] 加载 FaissStore (IndexFlatIP)...`)
  const store = await loadCosineFaissStore(storeDir, embeddings)

  // 统计文档数
  let docCount = 0
  if (store.docstore && store.docstore._docs) {
    const docsMap = store.docstore._docs
    docCount = docsMap instanceof Map ? docsMap.size : Object.keys(docsMap).length
  }
  console.log(`        索引文档数: ${docCount}`)

  if (docCount === 0) {
    console.log(`  ⚠️  索引为空，请先索引知识库文件`)
    return null
  }

  console.log(`  [3/3] 执行检索 (余弦相似度 = IndexFlatIP 内积)...`)
  console.log(`        查询: "${query}"`)

  // similaritySearchWithScore 返回的 score 即为余弦相似度（越大越相似）
  const searchK = Math.max(10, 3 * 3)
  const results = await store.similaritySearchWithScore(query, searchK)

  console.log(`\n  原始检索结果 (${results.length} 条):`)
  const allResults = []
  for (const [doc, score] of results) {
    const confidence = scoreToConfidence(score)
    const source = (doc.metadata && doc.metadata.source) || ''
    const docId = doc.metadata && doc.metadata.docId
    console.log(`    - cosine=${score.toFixed(4)}, confidence=${confidence.toFixed(4)}, docId=${docId || '无'}, source=${path.basename(source || '未知')}`)
    allResults.push({ doc, confidence, score, docId })
  }

  // 置信度过滤
  const threshold = 0.7
  const filtered = allResults.filter(r => r.confidence >= threshold)
  console.log(`\n  置信度 ≥ ${threshold} 的结果: ${filtered.length} 条`)

  // TOP 3
  filtered.sort((a, b) => b.confidence - a.confidence)
  const top3 = filtered.slice(0, 3)

  console.log(`\n  TOP 3 结果（含父块查表）:`)
  for (let i = 0; i < top3.length; i++) {
    const r = top3[i]
    console.log(`\n  --- 结果 #${i + 1} ---`)
    console.log(`  置信度(余弦相似度): ${(r.confidence * 100).toFixed(2)}%`)
    console.log(`  原始分数: ${r.score.toFixed(6)}`)
    console.log(`  来源: ${r.doc.metadata?.source || '未知'}`)
    console.log(`  文件类型: ${r.doc.metadata?.fileType || '未知'}`)
    console.log(`  docId: ${r.docId || '无'}`)

    // 父块查表
    if (r.docId) {
      const parentDoc = getParentDoc(r.docId)
      if (parentDoc) {
        console.log(`  ✓ 命中父块 (Small-to-Big):`)
        console.log(`    父块 UUID: ${parentDoc.uuid}`)
        console.log(`    父块来源: ${parentDoc.source_path}`)
        console.log(`    父块内容长度: ${parentDoc.content.length}`)
        console.log(`    父块内容预览: ${parentDoc.content.substring(0, 200)}...`)
      } else {
        console.log(`  - 无父块，使用子块自身文本`)
        console.log(`    子块内容预览: ${r.doc.pageContent.substring(0, 200)}...`)
      }
    } else {
      console.log(`  - 无 docId，使用子块自身文本`)
      console.log(`    子块内容预览: ${r.doc.pageContent.substring(0, 200)}...`)
    }
  }

  return top3
}

// ==================== 主流程 ====================

async function main() {
  const query = process.argv[2] || '什么是RAG'
  const kbType = process.argv[3] || 'personal'

  console.log('╔══════════════════════════════════════════════╗')
  console.log('║   RAG 检索测试（余弦相似度 IndexFlatIP）      ║')
  console.log('╚══════════════════════════════════════════════╝')

  // 初始化数据库（用于父块查表）
  await initDb()

  // 单元测试
  const normPassed = testNormalizeVector()
  const ipPassed = await testIndexFlatIP()

  // 集成测试
  await testFaissSearch(query, kbType)

  console.log('\n========== 测试总结 ==========')
  console.log(`  L2 归一化: ${normPassed ? '✅ 通过' : '❌ 失败'}`)
  console.log(`  IndexFlatIP 余弦相似度: ${ipPassed ? '✅ 通过' : '❌ 失败'}`)
  console.log('\n注意：如果 FaissStore 检索无结果，可能原因：')
  console.log('  1. 旧索引使用 IndexFlatL2 → 需要在应用中重新索引知识库')
  console.log('  2. 知识库为空 → 需要先添加文件并索引')
  console.log('  3. 置信度未达 0.7 阈值 → 查询与知识库内容相关度不足')
}

main().catch((e) => {
  console.error('测试执行失败:', e)
  process.exit(1)
})
