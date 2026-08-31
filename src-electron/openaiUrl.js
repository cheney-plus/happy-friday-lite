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
