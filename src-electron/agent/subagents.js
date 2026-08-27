/**
 * 子 Agent 配置
 * ===============
 * 设计参考：Agent智能体设计.md 2.7
 *
 * 预置一个通用「researcher」子 Agent 用于并行调研。
 * 用户可在 subagents.js 中追加自定义子 Agent，无需改动核心代码。
 *
 * DeepAgent 内置的 `task` 工具会自动派发任务给子 Agent。
 */

import { createLogger } from './logger.js'
import { SUBAGENT_RESEARCHER_PROMPT } from '../../src/config/prompts.js'

const log = createLogger('Subagents')

/**
 * 预置子 Agent 配置
 * - researcher: 通用调研子 Agent，用于多步搜索/检索/汇总
 *
 * @returns {Array} SubAgent 配置数组
 */
export function buildSubagents() {
  const subagents = [
    {
      name: 'researcher',
      description:
        '通用调研子 Agent。当主 Agent 需要进行多步搜索、跨知识库检索、信息汇总时，可派发任务给此子 Agent。',
      prompt: SUBAGENT_RESEARCHER_PROMPT
    }
  ]

  log.info(`已装配 ${subagents.length} 个子 Agent: ${subagents.map(s => s.name).join(', ')}`)
  return subagents
}

export default buildSubagents()
