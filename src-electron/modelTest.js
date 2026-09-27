/**
 * 模型连通性测试
 * ==============
 * 在「设置→模型」弹窗中点击「测试」时调用，验证配置的对话模型 / Embedding 模型
 * 是否能正常连通并返回结果。
 *
 * - 对话模型：向 /chat/completions 发送一条极短消息
 * - Embedding 模型：向 /embeddings 发送一段短文本
 *
 * "其他"厂商的地址为完整端点 URL，与 agent/modelAdapter.js、rag/embeddings.js
 * 的处理方式保持一致（对话模型先做归一化，Embedding 直接使用原始 URL）。
 */

import { buildChatCompletionsUrl } from './openaiUrl.js'

const TEST_TIMEOUT_MS = 30000

async function postJson(url, apiKey, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS)
  const startedAt = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const text = await res.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch (_e) { /* 非 JSON 响应 */ }
    return { ok: res.ok, status: res.status, body: parsed, rawText: text, latencyMs: Date.now() - startedAt }
  } finally {
    clearTimeout(timer)
  }
}

function extractApiErrorMessage(parsed, rawText) {
  const msg = parsed?.error?.message || parsed?.message || ''
  return msg || (rawText ? rawText.slice(0, 200) : '')
}

function buildRequestError(status, parsed, rawText) {
  const detail = extractApiErrorMessage(parsed, rawText)
  return detail ? `请求失败（${status}）：${detail}` : `请求失败（${status}）`
}

/**
 * 测试对话模型连通性
 * @param {Object} params - { apiKey, modelName, baseUrl }
 * @returns {Promise<{latencyMs: number, reply: string, usage: Object|null}>}
 */
export async function testChatModel({ apiKey, modelName, baseUrl } = {}) {
  if (!apiKey) throw new Error('请先填写 API Key')
  if (!modelName) throw new Error('请先填写对话模型名称')
  // 兼容 base URL 或完整端点两种写法
  const url = buildChatCompletionsUrl(baseUrl)
  if (!url) throw new Error('请先填写模型地址')

  const { ok, status, body, rawText, latencyMs } = await postJson(url, apiKey, {
    model: modelName,
    messages: [{ role: 'user', content: '你好' }],
    max_tokens: 16,
    stream: false
  })
  if (!ok) throw new Error(buildRequestError(status, body, rawText))

  const content = body?.choices?.[0]?.message?.content
  if (content == null) {
    throw new Error('响应格式异常，未返回对话内容')
  }
  return {
    latencyMs,
    reply: typeof content === 'string' ? content.slice(0, 100) : '',
    usage: body?.usage || null
  }
}

/**
 * 测试 Embedding 模型连通性
 * @param {Object} params - { provider, apiKey, embeddingModelName, baseUrl,
 *   useSeparateEmbeddingConfig, embeddingApiKey, embeddingBaseUrl }
 * @returns {Promise<{latencyMs: number, dimension: number}>}
 */
export async function testEmbeddingModel(params = {}) {
  const {
    provider,
    apiKey,
    embeddingModelName,
    baseUrl,
    useSeparateEmbeddingConfig,
    embeddingApiKey,
    embeddingBaseUrl
  } = params

  if (!embeddingModelName) throw new Error('请先填写 Embedding 模型名称')

  // 与 rag/embeddings.js 的配置取用逻辑保持一致：
  // 仅"其他"厂商可为 Embedding 模型单独配置地址与 API Key
  const rawUrl = provider === 'other'
  const useSeparate = rawUrl && useSeparateEmbeddingConfig && embeddingApiKey && embeddingBaseUrl
  const effApiKey = useSeparate ? embeddingApiKey : apiKey
  const effBaseUrl = useSeparate ? embeddingBaseUrl : baseUrl

  if (!effApiKey) throw new Error('请先填写 API Key')
  if (!effBaseUrl) throw new Error('请先填写模型地址')

  // 多模态 Embedding 模型使用 /embeddings/multimodal 端点
  const isMultimodal = /vision/i.test(embeddingModelName)
  const fullUrl = rawUrl
    ? effBaseUrl
    : `${effBaseUrl.replace(/\/+$/, '')}/embeddings${isMultimodal ? '/multimodal' : ''}`

  const requestBody = isMultimodal
    ? { model: embeddingModelName, input: [{ type: 'text', text: '连通性测试' }] }
    : { model: embeddingModelName, input: ['连通性测试'] }

  const { ok, status, body, rawText, latencyMs } = await postJson(fullUrl, effApiKey, requestBody)
  if (!ok) throw new Error(buildRequestError(status, body, rawText))

  let dimension = 0
  if (Array.isArray(body?.data) && body.data.length) {
    // 标准 OpenAI 格式：data 为数组 [{index, embedding}]
    dimension = body.data[0]?.embedding?.length || 0
  } else if (body?.data?.embedding) {
    // 多模态格式：data 为单个对象 {embedding, object}
    dimension = body.data.embedding.length || 0
  }
  if (!dimension) {
    throw new Error('响应格式异常，未返回向量数据')
  }
  return { latencyMs, dimension }
}
