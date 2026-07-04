/**
 * Agent 工具注册中心
 *
 * 设计参考：src/views/knowledge/agent/Agent智能体设计.md §5
 *
 * 设计目标：用户后期只需写一个 Tool 文件并注册，无需改动 Agent 核心。
 * 流程：写代码 → registerTool() → import 到 tools/index.js → 即用。
 *
 * 工具结构：
 *   {
 *     name: string,                  // 工具名（唯一）
 *     description: string,           // 工具描述（给 LLM 看）
 *     parameters: object,            // JSON Schema 参数定义（OpenAI function calling 格式）
 *     handler: async (args, ctx) => string,  // 工具执行函数，返回字符串
 *     meta: {                        // 元信息
 *       requireApproval?: boolean,   // 是否需要人机交互审批
 *       category?: string,           // 分类标签
 *     }
 *   }
 *
 * Tool Context（ctx）提供以下能力：
 *   - db: src-electron/db.js 实例
 *   - dataDir: 项目 userData 目录
 *   - agentRootDir: agent 目录绝对路径
 *   - threadId: 当前会话 ID
 *   - mainWindow: Electron 主窗口（可推送事件）
 *   - logger: 统一日志器
 *   - emit(event, payload): 便捷推送 IPC 事件
 */

import { logger } from '../logger.js'

const log = logger.scope('Tool')

// 工具注册表（内存常驻）
const _registry = []

/**
 * 注册一个 Agent 工具
 * @param {Object} opts 工具选项
 */
export function registerTool(opts) {
  if (!opts || !opts.name || !opts.description || typeof opts.handler !== 'function') {
    throw new Error('[Agent] registerTool 参数不合法：需要 name/description/handler')
  }
  if (_registry.some((t) => t.name === opts.name)) {
    throw new Error(`[Agent] 工具 "${opts.name}" 已注册`)
  }
  _registry.push(opts)
  log.info(`工具已注册: ${opts.name}${opts.meta?.requireApproval ? ' (需审批)' : ''}`)
}

/**
 * 获取所有已注册工具的元信息（供前端展示）
 */
export function listRegisteredTools() {
  return _registry.map((t) => ({
    name: t.name,
    description: t.description,
    category: t.meta?.category || 'default',
    requireApproval: !!t.meta?.requireApproval,
  }))
}

/**
 * 构造 OpenAI Function Calling 工具定义数组
 * 返回格式：[{ type: 'function', function: { name, description, parameters } }]
 */
export function buildToolDefinitions() {
  return _registry.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: 'object', properties: {} },
    },
  }))
}

/**
 * 构造需审批工具名集合（用于 Agent 循环判断是否触发 HITL）
 * @returns {Set<string>}
 */
export function buildApprovalSet() {
  const set = new Set()
  for (const t of _registry) {
    if (t.meta?.requireApproval) set.add(t.name)
  }
  return set
}

/**
 * 按工具名获取工具定义
 * @param {string} name
 */
export function getTool(name) {
  return _registry.find((t) => t.name === name) || null
}

/**
 * 执行指定工具
 * @param {string} name 工具名
 * @param {Object} args 工具参数
 * @param {Object} ctx Tool Context
 * @returns {Promise<string>} 工具执行结果（字符串）
 */
export async function executeTool(name, args, ctx) {
  const tool = getTool(name)
  if (!tool) {
    log.warn(`未知工具: ${name}`)
    return `错误：未知工具 "${name}"`
  }

  const start = Date.now()
  log.info(`调用工具: ${name}, args=${JSON.stringify(args).slice(0, 200)}`)

  try {
    const result = await tool.handler(args || {}, ctx)
    const duration = Date.now() - start
    const preview = typeof result === 'string' ? result.slice(0, 100) : String(result)
    log.info(`工具完成: ${name}, 耗时 ${duration}ms, 结果预览="${preview}..."`)
    return result
  } catch (e) {
    const duration = Date.now() - start
    log.error(`工具失败: ${name}, 耗时 ${duration}ms, 错误=${e.message}`)
    return `工具执行失败: ${e.message}`
  }
}
