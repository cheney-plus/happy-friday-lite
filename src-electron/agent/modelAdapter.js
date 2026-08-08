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
import { recordUsage } from '../usage.js'

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

  // 构造 baseURL：LangChain SDK 会自动追加 /chat/completions
  // - 非 'other' provider：直接用 baseUrl（如 https://api.deepseek.com）
  // - 'other' provider：baseUrl 可能含 /chat/completions，需剥离避免重复
  let lcBaseUrl = (baseUrl || '').replace(/\/+$/, '')
  if (provider === 'other') {
    lcBaseUrl = lcBaseUrl.replace(/\/chat\/completions\/?$/i, '')
  }

  log.info(`创建模型: provider=${provider}, model=${modelName}, baseURL=${lcBaseUrl}, thinking=${!!enableThinking}`)

  // 构造思考模式差异化参数（参考 llm.js buildStreamBody）
  // @langchain/core v1.x 已移除 Runnable.bind()，改用 modelKwargs 在构造时注入
  const modelKwargs = buildThinkingKwargs(provider, enableThinking)

  // 用量统计回调：DeepAgent 路径下，每次 LLM 调用结束都会触发 handleLLMEnd，
  // 从 output.llmOutput 中提取 token 用量并落库。
  // LangChain 的 llmOutput 有多种可能结构（均为 camelCase 字段）：
  //   - { tokenUsage: { promptTokens, completionTokens, totalTokens } }  // 流式/非流式真实用量
  //   - { estimatedTokenUsage: { promptTokens, completionTokens, totalTokens } }  // 流式估算用量
  //   - { usage: { prompt_tokens, completion_tokens, total_tokens } }  // 原始 API 字段（snake_case）
  // 此外，真实用量也可能存在于 generations[0][0].message.usage_metadata 中。
  const usageCallback = {
    handleLLMEnd(output) {
      try {
        // 优先从 llmOutput 提取，再回退到 message.usage_metadata
        const llmOutput = output?.llmOutput
        const raw = llmOutput?.tokenUsage || llmOutput?.estimatedTokenUsage || llmOutput?.usage

        // message.usage_metadata 携带流式 API 返回的真实用量（优先级最高）
        const msgMeta = output?.generations?.[0]?.[0]?.message?.usage_metadata

        const promptTokens = Number(
          msgMeta?.input_tokens ?? raw?.promptTokens ?? raw?.prompt_tokens ?? 0
        ) || 0
        const completionTokens = Number(
          msgMeta?.output_tokens ?? raw?.completionTokens ?? raw?.completion_tokens ?? 0
        ) || 0
        const totalTokens = Number(
          msgMeta?.total_tokens ?? raw?.totalTokens ?? raw?.total_tokens ?? (promptTokens + completionTokens)
        ) || 0
        const reasoningTokens = Number(
          msgMeta?.output_token_details?.reasoning ?? raw?.completion_tokens_details?.reasoning_tokens ?? 0
        ) || 0

        if (promptTokens === 0 && completionTokens === 0) {
          log.warn(`Agent 用量为 0，llmOutput=${JSON.stringify(llmOutput)}, msgMeta=${JSON.stringify(msgMeta)}`)
          return
        }

        recordUsage({
          modelId: modelConfig.id || '',
          modelName: modelName || '',
          provider: provider || '',
          providerLabel: modelConfig.providerLabel || provider || '',
          promptTokens,
          completionTokens,
          totalTokens,
          reasoningTokens,
          source: 'agent'
        })
      } catch (e) {
        log.warn(`用量统计回调异常: ${e.message}`)
      }
    }
  }

  // 关键：baseURL 必须放在 configuration 参数里
  // 否则 OpenAI SDK 会使用默认的 https://api.openai.com/v1 导致连接失败
  const model = new ChatOpenAI({
    model: modelName,
    apiKey: apiKey,
    configuration: {
      baseURL: lcBaseUrl
    },
    streaming: true,
    // 启用流式 usage 上报：SDK 会自动附加 stream_options.include_usage=true，
    // 并在流结束时通过 handleLLMEnd 回调聚合出 usage 数据，用于 Token 用量统计
    streamUsage: true,
    modelKwargs,
    callbacks: [usageCallback]
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
