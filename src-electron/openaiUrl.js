const CHAT_COMPLETIONS_SUFFIX = /(?:\/chat\/completions)+$/i

/**
 * Converts an OpenAI-compatible base URL or chat-completions endpoint into a
 * base URL accepted by SDKs that append `/chat/completions` themselves.
 */
export function normalizeOpenAIBaseUrl(baseUrl) {
  return String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(CHAT_COMPLETIONS_SUFFIX, '')
}

/**
 * Returns exactly one OpenAI-compatible chat-completions endpoint.
 */
export function buildChatCompletionsUrl(baseUrl) {
  const normalizedBaseUrl = normalizeOpenAIBaseUrl(baseUrl)
  return normalizedBaseUrl ? `${normalizedBaseUrl}/chat/completions` : ''
}

// 共用配置从对话地址推导向量接口；独立配置可使用自定义完整端点。
export function buildEmbeddingUrl(address, { useExactUrl = false, multimodal = false } = {}) {
  const url = new URL(address.trim())
  if (!useExactUrl && !/\/embeddings(?:\/multimodal)?\/?$/i.test(url.pathname)) {
    url.pathname = `${normalizeOpenAIBaseUrl(url.pathname)}/embeddings${multimodal ? '/multimodal' : ''}`
  }
  return url.href
}
