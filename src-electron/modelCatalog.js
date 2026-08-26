const PROVIDER_BASE_URLS = {
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com',
  kimi: 'https://api.moonshot.cn/v1',
  minimax: 'https://api.minimaxi.com/v1'
}

/**
 * Fetch models enabled for the supplied API key using each provider's
 * OpenAI-compatible Models endpoint. URLs are intentionally fixed here.
 */
export async function listProviderModels(provider, apiKey) {
  const baseUrl = PROVIDER_BASE_URLS[provider]
  if (!baseUrl) throw new Error('该厂商暂不支持自动获取模型列表')
  if (!apiKey || typeof apiKey !== 'string') throw new Error('请先填写 API Key')

  const response = await fetch(`${baseUrl}/models`, {
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
  const models = entries
    .map(item => typeof item === 'string' ? item : item?.id || item?.model)
    .filter(Boolean)

  if (!models.length) throw new Error('未获取到可用模型')
  return [...new Set(models)].sort((a, b) => a.localeCompare(b))
}
