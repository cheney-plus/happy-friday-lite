import { buildChatCompletionsUrl } from './openaiUrl.js'

const PROVIDER_BASE_URLS = {
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com',
  kimi: 'https://api.moonshot.cn/v1',
  minimax: 'https://api.minimaxi.com/v1'
}

export async function testChatModel(model = {}) {
  const apiKey = String(model.apiKey || '').trim()
  const modelName = String(model.modelName || '').trim()
  const baseUrl = resolveChatBaseUrl(model)
  if (!apiKey) throw new Error('API Key is required')
  if (!modelName) throw new Error('Chat model name is required')
  if (!baseUrl) throw new Error('Chat model URL is required')

  const response = await fetch(buildChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: 'ping' }],
      stream: false,
      max_tokens: 8
    }),
    signal: AbortSignal.timeout(20_000)
  })

  const payload = await safeJson(response)
  if (!response.ok) {
    throw new Error(`Chat test failed (${response.status}): ${formatApiError(payload)}`)
  }
  if (payload?.error) throw new Error(`Chat test failed: ${formatApiError(payload)}`)
  if (!Array.isArray(payload?.choices)) throw new Error('Chat test response missing choices')
  return { ok: true, model: payload.model || modelName }
}

export async function testEmbeddingModel(model = {}) {
  const useSeparate = model.useSeparateEmbeddingConfig && model.embeddingApiKey && model.embeddingBaseUrl
  const apiKey = String(useSeparate ? model.embeddingApiKey : model.apiKey || '').trim()
  const modelName = String(model.embeddingModelName || '').trim()
  const endpoint = resolveEmbeddingEndpoint(model, useSeparate)
  if (!apiKey) throw new Error('Embedding API Key is required')
  if (!modelName) throw new Error('Embedding model name is required')
  if (!endpoint) throw new Error('Embedding model URL is required')

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      input: 'ping'
    }),
    signal: AbortSignal.timeout(20_000)
  })

  const payload = await safeJson(response)
  if (!response.ok) {
    throw new Error(`Embedding test failed (${response.status}): ${formatApiError(payload)}`)
  }
  if (payload?.error) throw new Error(`Embedding test failed: ${formatApiError(payload)}`)
  const embedding = Array.isArray(payload?.data) ? payload.data[0]?.embedding : payload?.data?.embedding
  if (!Array.isArray(embedding) || !embedding.length) throw new Error('Embedding test response missing vector')
  return { ok: true, dimensions: embedding.length, model: payload.model || modelName }
}

function resolveChatBaseUrl(model) {
  if (model.provider === 'other') return model.baseUrl || model.modelUrl || ''
  return model.baseUrl || PROVIDER_BASE_URLS[model.provider] || ''
}

function resolveEmbeddingEndpoint(model, useSeparate) {
  if (useSeparate) return String(model.embeddingBaseUrl || model.embeddingUrl || '').trim()
  if (model.provider === 'other') return String(model.embeddingBaseUrl || model.embeddingUrl || model.baseUrl || model.modelUrl || '').trim()
  const baseUrl = String(model.baseUrl || PROVIDER_BASE_URLS[model.provider] || '').replace(/\/+$/, '')
  if (!baseUrl) return ''
  return `${baseUrl}/embeddings`
}

async function safeJson(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (e) {
    return { raw: text.slice(0, 500) }
  }
}

function formatApiError(payload) {
  if (!payload) return 'empty response'
  if (payload.error?.message) return payload.error.message
  if (payload.message) return payload.message
  if (payload.raw) return payload.raw
  return JSON.stringify(payload).slice(0, 500)
}

