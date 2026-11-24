import { normalizeOpenAIBaseUrl } from './openaiUrl.js'

const PROVIDER_BASE_URLS = {
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com',
  kimi: 'https://api.moonshot.cn/v1',
  minimax: 'https://api.minimaxi.com/v1'
}

// 优先使用服务返回的能力信息；只返回 ID 时再按名称识别。
function modelKinds(entry, id) {
  const capabilities = entry?.capabilities
  const tags = [
    entry?.type,
    ...(Array.isArray(capabilities) ? capabilities : Object.keys(capabilities || {}).filter(key => capabilities[key] === true)),
    ...(Array.isArray(entry?.supported_endpoint_types) ? entry.supported_endpoint_types : []),
    ...(Array.isArray(entry?.supported_endpoints) ? entry.supported_endpoints : [])
  ].filter(tag => typeof tag === 'string').map(tag => tag.trim().toLowerCase())
  const modality = entry?.architecture?.modality
  const inputs = entry?.input_modalities || entry?.architecture?.input_modalities
  const embedding = tags.some(tag => /(?:^|\/)(embeddings?|embed|vector)$/.test(tag))
  const chat = tags.some(tag => /(?:^|\/)(chat|chat[-_ /]completions?)$/.test(tag))
  if (tags.some(tag => /^(multimodal|vision)$/.test(tag))) return ['chat', 'embedding']
  if (chat && embedding) return ['chat', 'embedding']
  if (embedding) return ['embedding']

  const multimodal =
    (Array.isArray(inputs) && inputs.includes('text') && inputs.some(input => ['image', 'audio', 'video'].includes(input))) ||
    (typeof modality === 'string' && /text\+(?:image|audio|video)|(?:image|audio|video)\+text/.test(modality))
  if (multimodal) return ['chat', 'embedding']
  if (chat) return ['chat']

  if (/embedding|embed|(?:^|[/_-])(?:vector|embo|bge|e5|gte)(?:$|[-_])/i.test(id)) return ['embedding']
  if (/(?:^|[/_.-])(?:multimodal|vision|vl|omni|llava)(?:$|[_.-])/i.test(id)) return ['chat', 'embedding']
  return ['chat']
}

/**
 * Fetch models enabled for the supplied API key using each provider's
 * OpenAI-compatible Models endpoint. Preset providers use their fixed URLs.
 */
export async function listProviderModels(provider, apiKey, customBaseUrl) {
  const baseUrl = provider === 'other' ? customBaseUrl : PROVIDER_BASE_URLS[provider]
  if (provider === 'other' && (typeof baseUrl !== 'string' || !baseUrl.trim())) {
    throw new Error('请先填写模型地址')
  }
  if (!baseUrl) throw new Error('该厂商暂不支持自动获取模型列表')
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('请先填写 API Key')

  const url = URL.parse(String(baseUrl).trim())
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('模型地址必须是有效的 HTTP 或 HTTPS URL')
  }
  const pathname = normalizeOpenAIBaseUrl(url.pathname).replace(/\/embeddings$/i, '')
  url.pathname = `${pathname}/models`
  url.hash = ''

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`
    },
    signal: AbortSignal.timeout(15000)
  })

  if (!response.ok) {
    throw new Error(`模型列表请求失败（${response.status}）`)
  }

  const payload = await response.json()
  const entries = Array.isArray(payload?.data) ? payload.data : []
  const models = { chat: new Set(), embedding: new Set() }
  for (const entry of entries) {
    const name = typeof entry === 'string' ? entry : entry?.id || entry?.model
    if (typeof name !== 'string' || !name.trim()) continue
    const id = name.trim()
    for (const kind of modelKinds(entry, id)) models[kind].add(id)
  }
  if (!models.chat.size && !models.embedding.size) throw new Error('未获取到可用模型')
  return {
    chat: [...models.chat].sort((a, b) => a.localeCompare(b)),
    embedding: [...models.embedding].sort((a, b) => a.localeCompare(b))
  }
}
