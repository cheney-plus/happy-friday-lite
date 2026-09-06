/**
 * 模型适配器
 * ==========
 * 设计参考：Agent智能体设计.md 2.4
 *
 * 把用户在「设置→模型」中配置的 provider/baseUrl/apiKey/modelName 适配为 LangChain `ChatOpenAI`。
 *
 * 关键约束（项目 lessons learned）：
 * - @langchain/openai v1.x：构造参数为 `apiKey`（非 `openAIApiKey`）
 * - @langchain/core v1.x：`Runnable.bind()` 已移除，改用构造参数 `modelKwargs` 注入额外参数
 * - baseURL 必须放在 `configuration` 参数里，否则 OpenAI SDK 会使用默认的 https://api.openai.com/v1
 * - LangChain ChatOpenAI SDK 会自动在 baseURL 末尾追加 `/chat/completions`
 */

import { ChatOpenAI } from '@langchain/openai'
import { createLogger } from './logger.js'
import { normalizeOpenAIBaseUrl } from '../openaiUrl.js'

const log = createLogger('Model')

/**
 * 把项目模型配置适配为 LangChain ChatOpenAI 实例
 * @param {Object} modelConfig 项目模型配置
 *   - provider: 'qwen'|'deepseek'|'zhipu'|'kimi'|'doubao'|'minimax'|'other'
 *   - baseUrl: API 基础地址
 *   - apiKey: API 密钥
 *   - modelName: 模型名
 *   - enableThinking: 是否启用思考模式
 * @returns {ChatOpenAI}
 */
export function createLangChainModel(modelConfig) {
  const { provider, baseUrl, apiKey, modelName, enableThinking } = modelConfig

  // LangChain SDK appends /chat/completions, so accept either a base URL or
  // a full endpoint and always pass it a normalized base URL.
  const lcBaseUrl = normalizeOpenAIBaseUrl(baseUrl)

  log.info(`创建模型: provider=${provider}, model=${modelName}, baseURL=${lcBaseUrl}, thinking=${!!enableThinking}`)

  // 构造思考模式差异化参数（参考 llm.js buildStreamBody）
  // @langchain/core v1.x 已移除 Runnable.bind()，改用 modelKwargs 在构造时注入
  const modelKwargs = buildThinkingKwargs(provider, enableThinking)

  // 关键：baseURL 必须放在 configuration 参数里
  // 否则 OpenAI SDK 会使用默认的 https://api.openai.com/v1 导致连接失败
  const model = new ChatOpenAI({
    model: modelName,
    apiKey: apiKey,
    configuration: {
      baseURL: lcBaseUrl
    },
    streaming: true,
    streamUsage: true,
    modelKwargs
  })

  return model
}

/**
 * 根据 provider 构造思考模式差异化参数
 * - qwen: enable_thinking
 * - minimax: reasoning_split
 * - deepseek/zhipu/kimi/doubao: thinking { type: 'enabled'|'disabled' }
 * @param {string} provider
 * @param {boolean} enableThinking
 * @returns {Object}
 */
function buildThinkingKwargs(provider, enableThinking) {
  switch (provider) {
    case 'qwen':
      return { enable_thinking: !!enableThinking }
    case 'minimax':
      return enableThinking ? { reasoning_split: true } : {}
    case 'deepseek':
    case 'zhipu':
    case 'kimi':
    case 'doubao':
      return { thinking: { type: enableThinking ? 'enabled' : 'disabled' } }
    default:
      return {}
  }
}
